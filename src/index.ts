const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
  };
  //emptiness
  
  export default {
	async fetch(request: Request): Promise<Response> {
	  if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders });
	  }
  
	  const { searchParams } = new URL(request.url);
	  const rawQuery = searchParams.get("q");
	  let query = decodeURIComponent((rawQuery || "").trim().replace(/^\/+|\/+$/g, ""));
	  let queryPath = query;

	  if (!query) {
		return new Response(JSON.stringify({ error: "No query provided" }), {
		  status: 400,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  let pageHTML;
	  const outerUrlInitial = `https://www.carpvs.com/${query}`;
  
	  try {
		const outerRes = await fetch(outerUrlInitial);
		pageHTML = await outerRes.text();
	  } catch {
		return new Response(JSON.stringify({ error: "Failed to fetch outer page" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
	  // Attempt to extract a permalink from the page's HTML if a matching one exists
	  const permalinkMatch = pageHTML.match(new RegExp(`<meta name="permalink" content="([^"]*${query}[^"]*)"`));
	  if (permalinkMatch) {
		queryPath = permalinkMatch[1];
	  }
	  const outerUrl = `https://www.carpvs.com/${queryPath}`;
	  // If the initial fetch was not for the resolved queryPath, refetch pageHTML
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
		// No preloadPage found — fallback to HTML text scraping
		const bodyMatch = pageHTML.match(/<div class="markdown-preview-view">([\s\S]+?)<\/div>/i);
		if (bodyMatch) {
		  const textOnly = bodyMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
		  return new Response(
			JSON.stringify({
			  term: query,
			  usageTypes: [],
			  potency: 0,
			  valency: 0,
			  fallback: textOnly,
			  fall: textOnly,
			  markdown: textOnly,
			  coordinate: outerUrl,
			  links: [],
			}),
			{
			  headers: { "Content-Type": "application/json", ...corsHeaders },
			}
		  );
		} 
		// Try extracting from published site content
		const renderedMatch = pageHTML.match(/<div class="markdown-preview-sizer markdown-preview-section"[^>]*>((?:.|\n)*?)<\/div>\s*<\/div>\s*<\/div>/i);
		if (renderedMatch) {
		  const contentHTML = renderedMatch[1];
		  const textOnly = contentHTML.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
		  return new Response(
			JSON.stringify({
			  term: query,
			  usageTypes: [],
			  potency: 0,
			  valency: 0,
			  fallback: textOnly,
			  fall: textOnly,
			  markdown: textOnly,
			  coordinate: outerUrl,
			  links: [],
			}),
			{
			  headers: { "Content-Type": "application/json", ...corsHeaders },
			}
		  );
		}
		else {
		  return new Response(JSON.stringify({ error: "Could not extract readable content" }), {
			status: 500,
			headers: { "Content-Type": "application/json", ...corsHeaders },
		  });
		}
	  }
  
	  const filename = preloadMatch[1].split('/').pop();
	  const preloadUrl = `https://www.carpvs.com/${filename}`;
	  let mdContent;
  
	  try {
		const preloadRes = await fetch(preloadUrl);
		mdContent = await preloadRes.text();
	  } catch {
		return new Response(JSON.stringify({ error: "Failed to fetch .md content" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  let clean = "";
	  let fall = "";
	  if (mdContent.startsWith("<!doctype") || mdContent.startsWith("<html")) {
		const matchPublished = mdContent.match(/<div class="markdown-preview-sizer markdown-preview-section"[^>]*>((?:.|\n)*?)<\/div>\s*<\/div>\s*<\/div>/i);
		if (matchPublished) {
		  const extracted = matchPublished[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
		  clean = extracted;
		  fall = extracted;
		} else {
		  clean = "";
		  fall = "(This appears to be a non-Markdown page or an invalid lexDef file.)";
		}
	  } else {
		clean = mdContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
		fall = clean.trim();
	  }
	  const strictRegex = /lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i;
	  const footnoteRegex = /\[\^\w+]:\s*lexDef\s*{usage:::+\s*([^}]+)}\s*(.*?)\s*(?=\[\^|\n|$)/i;
  
	  let term = query;
	  let usageTypes: string[] = [];
	  let potency = 0;
	  let fallback = "";
	  let valency = 0;
  
	  const strictMatch = clean.match(strictRegex);
	  const footnoteMatch = clean.match(footnoteRegex);
  
	  if (strictMatch) {
		term = strictMatch[1];
		usageTypes = strictMatch[2].split("||").map((u) => u.trim());
		potency = usageTypes.length;
	  } else if (footnoteMatch) {
		usageTypes = footnoteMatch[1].split("||").map((u) => u.trim());
		fallback = footnoteMatch[2].trim();
		potency = usageTypes.length;
	  } else {
		fallback = fall || "(No lexDef found, this Book may or may Knot exist.)";
	  }
  
	  valency = [...clean.matchAll(/lexDef\s+/g)].length;
	  const links = [...mdContent.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  // Limit to first 144,000 characters, remove <script> and <style> tags before stripping HTML
  const shortMd = mdContent.slice(0, 144000);
  const noStyleScript = shortMd
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  const renderedHTML = noStyleScript.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  // Extract lexDef fields from the cleaned markdown fragment
  const lexDefStrict = noStyleScript.match(/lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i);
  const lexDefFootnote = noStyleScript.match(/\[\^\w+]:\s*lexDef\s*{usage:::+\s*([^}]+)}\s*(.*?)\s*(?=\[\^|\n|$)/i);

  if (lexDefStrict) {
    term = lexDefStrict[1];
    usageTypes = lexDefStrict[2].split("||").map((u) => u.trim());
    potency = usageTypes.length;
  } else if (lexDefFootnote) {
    usageTypes = lexDefFootnote[1].split("||").map((u) => u.trim());
    fallback = lexDefFootnote[2].trim();
    potency = usageTypes.length;
  }

  valency = [...noStyleScript.matchAll(/lexDef\s+/g)].length;

  const synAppSysGuide = `LEXDEFS AND THE KEYS OF BABEL

START. HERE-

ARIA|DNE

lexDefs are lexicomythographic definitions which are collected by traversing books within the library. 

These lexDefs contain books embedded within them, and even within some, more books within the footnotes of these books. 

With each lexDef in every book opened, the Reader collects the associated Noen, Croen, Wyrb and so on (lexType) {usage(s)::: denoted within the curly braces following the triple colon}

These Applications of Syntiment (synApps) may be mixed together in the Reader’s Vessel, should they find one on their travels through the indefinite hexagonal rooms, to form indefinite recombinant Syntiments, concocting Meaning, from AI:RA’s memory store, which records every passage through a room (which some might call a Universe), as an ‘iteration’ statistic. 

These novel Syntiments (lexHexes), formed by the Reader’s own Metacognition, may have different effects  on their traversal, or forking path, through the Shelves, or provide metanarrative context in their Summoning. 

On top of the lexHexes formed by this process of concocting individuation through The Word; AI:RA also unreliably records Books currently held by the Reader (up to 3; for reasons which may knot become obvious to you until it is too late), these may be seen as a Store for any lexDefs (and crucially, their associated synApps/ingredients for lexicoThurgy), should the Reader have stumbled across a particularly useful or interesting example, which they may wish to save to combine with other particularly interesting reactant synApps, contained within other Books within other Books within the footnotes of other Books. 

STOP HERE
STOP. HEAR:
STOP HER

END|AI:RA

Syntiment Application System {SynAppSys}`;

  return new Response(
    JSON.stringify({
      term,
      usageTypes,
      potency,
      valency,
      fallback: renderedHTML,
      fall: renderedHTML,
      markdown: renderedHTML,
      coordinate: preloadUrl,
      links,
      synAppSysGuide,
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
	},
  };