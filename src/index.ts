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
		return new Response(JSON.stringify({ error: "Could not find preloadPage URL" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
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
	  if (filename.endsWith(".md")) {
		clean = mdContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
		fall = clean.trim();
	  } else {
		clean = "";
		fall = "(This appears to be a non-Markdown page or an invalid lexDef file.)";
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
  
	  return new Response(
		JSON.stringify({
		  term,
		  usageTypes,
		  potency,
		  valency,
		  fallback,
		  fall,
		  markdown: mdContent,
		  coordinate: preloadUrl,
		  links,
		}),
		{
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		}
	  );
	},
  };