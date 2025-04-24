const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
  };
  
  export default {
	async fetch(request: Request): Promise<Response> {
	  if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders });
	  }
  
	  const { searchParams } = new URL(request.url);
	  const rawQuery = searchParams.get("q");
	  const query = decodeURIComponent((rawQuery || "").trim().replace(/^\/+|\/+$/g, ""));
	  let queryPath = query;
  
	  if (!query) {
		return new Response(JSON.stringify({ error: "No query provided" }), {
		  status: 400,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const outerUrlInitial = `https://www.carpvs.com/${query}`;
	  let pageHTML = "";
  
	  try {
		const outerRes = await fetch(outerUrlInitial);
		pageHTML = await outerRes.text();
	  } catch {
		return new Response(JSON.stringify({ error: "Failed to fetch outer page" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const permalinkMatch = pageHTML.match(new RegExp(`<meta name="permalink" content="([^"]*${query}[^"]*)"`));
	  if (permalinkMatch) {
		queryPath = permalinkMatch[1];
	  }
  
	  const outerUrl = `https://www.carpvs.com/${queryPath}`;
	  if (queryPath !== query) {
		try {
		  const outerRes = await fetch(outerUrl);
		  pageHTML = await outerRes.text();
		} catch {
		  return new Response(JSON.stringify({ error: "Failed to fetch outer page by permalink" }), {
			status: 500,
			headers: { "Content-Type": "application/json", ...corsHeaders },
		  });
		}
	  }
  
	  const preloadMatch = pageHTML.match(/window\.preloadPage\s*=\s*\w+\("([^"]+)"/);
	  if (!preloadMatch) {
		// Enhanced Cheerio-style fallback for HTML extraction and metadata
		const cheerio = require("cheerio");
		const $ = cheerio.load(pageHTML);
		let extractedText = "";

		// Try grabbing the div.markdown-preview-view first
		const previewView = $('.markdown-preview-view').html();
		if (previewView) {
		  extractedText = cheerio.load(previewView).text().replace(/\s+/g, " ").trim();
		} else {
		  // Try .markdown-preview-sizer markdown-preview-section fallback
		  const sizer = $('.markdown-preview-sizer.markdown-preview-section').html();
		  if (sizer) {
			extractedText = cheerio.load(sizer).text().replace(/\s+/g, " ").trim();
		  }
		}

		if (extractedText) {
		  // Recalculate term, valency, links, potency from HTML
		  const valency = [...pageHTML.matchAll(/lexDef\s+/g)].length;
		  const wikilinks = [...pageHTML.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
		  const uniqueLinks = [...new Set(wikilinks)];
		  const potency = uniqueLinks.length;

		  return new Response(JSON.stringify({
			term: query,
			usageTypes: [],
			potency,
			valency,
			fallback: extractedText,
			fall: extractedText,
			markdown: extractedText,
			coordinate: outerUrl,
			links: uniqueLinks,
		  }), {
			headers: { "Content-Type": "application/json", ...corsHeaders },
		  });
		}

		return new Response(JSON.stringify({ error: "Could not extract readable content" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const filename = preloadMatch[1].split('/').pop();
	  const preloadUrl = `https://www.carpvs.com/${filename}`;
	  let mdContent = "";
  
	  try {
		const preloadRes = await fetch(preloadUrl);
		mdContent = await preloadRes.text();
	  } catch {
		return new Response(JSON.stringify({ error: "Failed to fetch .md content" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  console.log("📄 RAW .md content:", mdContent.slice(0, 500));
  
	  if (mdContent.startsWith("<!doctype") || mdContent.startsWith("<html")) {
		// fallback to render from HTML if it's not actual .md
		const cheerio = require("cheerio");
		const $ = cheerio.load(mdContent);
		let extractedText = "";

		const previewView = $('.markdown-preview-view').html();
		if (previewView) {
		  extractedText = cheerio.load(previewView).text().replace(/\s+/g, " ").trim();
		} else {
		  const sizer = $('.markdown-preview-sizer.markdown-preview-section').html();
		  if (sizer) {
			extractedText = cheerio.load(sizer).text().replace(/\s+/g, " ").trim();
		  }
		}

		if (extractedText) {
		  const valency = [...mdContent.matchAll(/lexDef\s+/g)].length;
		  const wikilinks = [...mdContent.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
		  const uniqueLinks = [...new Set(wikilinks)];
		  const potency = uniqueLinks.length;

		  return new Response(JSON.stringify({
			term: query,
			usageTypes: [],
			potency,
			valency,
			fallback: extractedText,
			fall: extractedText,
			markdown: extractedText,
			coordinate: preloadUrl,
			links: uniqueLinks,
		  }), {
			headers: { "Content-Type": "application/json", ...corsHeaders },
		  });
		}

		return new Response(JSON.stringify({ error: "HTML fallback failed to extract content." }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const shortMd = mdContent.slice(0, 144000);
	  const noStyleScript = shortMd
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
	  const renderedHTML = noStyleScript.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  
	  const strictRegex = /lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i;
	  const footnoteRegex = /\[\^\w+]:\s*lexDef\s*{usage:::+\s*([^}]+)}\s*(.*?)\s*(?=\[\^|\n|$)/i;
  
	  let term = query;
	  let usageTypes: string[] = [];
	  let potency = 0;
	  let fallback = renderedHTML;
	  let valency = [...noStyleScript.matchAll(/lexDef\s+/g)].length;
  
	  const strictMatch = noStyleScript.match(strictRegex);
	  const footnoteMatch = noStyleScript.match(footnoteRegex);
  
	  if (strictMatch) {
		term = strictMatch[1];
		usageTypes = strictMatch[2].split("||").map((u) => u.trim());
		potency = usageTypes.length;
	  } else if (footnoteMatch) {
		usageTypes = footnoteMatch[1].split("||").map((u) => u.trim());
		fallback = footnoteMatch[2].trim();
		potency = usageTypes.length;
	  }
  
	  const links = [...mdContent.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  
	  return new Response(JSON.stringify({
		term,
		usageTypes,
		potency,
		valency,
		fallback,
		fall: fallback,
		markdown: fallback,
		coordinate: preloadUrl,
		links,
	  }), {
		headers: { "Content-Type": "application/json", ...corsHeaders },
	  });
	},
  };