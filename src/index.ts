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
		const bodyMatch = pageHTML.match(/<div class="markdown-preview-view">([\s\S]+?)<\/div>/i);
		if (bodyMatch) {
		  const textOnly = bodyMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
		  return new Response(JSON.stringify({
			term: query,
			usageTypes: [],
			potency: 0,
			valency: 0,
			fallback: textOnly,
			fall: textOnly,
			markdown: textOnly,
			coordinate: outerUrl,
			links: [],
		  }), {
			headers: { "Content-Type": "application/json", ...corsHeaders },
		  });
		}
  
		const renderedMatch = pageHTML.match(/<div class="markdown-preview-sizer markdown-preview-section"[^>]*>([\s\S]+?)<div class="el-section">/i);
		if (renderedMatch) {
		  const textOnly = renderedMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
		  return new Response(JSON.stringify({
			term: query,
			usageTypes: [],
			potency: 0,
			valency: 0,
			fallback: textOnly,
			fall: textOnly,
			markdown: textOnly,
			coordinate: outerUrl,
			links: [],
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
  
	  const shortMd = mdContent.slice(0, 144000);
	  const noStyleScript = shortMd
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
	  const renderedHTML = noStyleScript.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  
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