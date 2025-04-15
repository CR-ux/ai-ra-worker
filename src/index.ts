const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
  };
  
  export default {
	async fetch(request: Request): Promise<Response> {
	  if (request.method === "OPTIONS") {
		return new Response(null, {
		  status: 204,
		  headers: corsHeaders,
		});
	  }
  
	  const { searchParams } = new URL(request.url);
	  const query = searchParams.get("q");
  
	  if (!query) {
		return new Response(JSON.stringify({ error: "No query provided" }), {
		  status: 400,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const outerUrl = `https://www.carpvs.com/${query}`;
	  let pageHTML;
  
	  try {
		const outerRes = await fetch(outerUrl);
		pageHTML = await outerRes.text();
	  } catch (err) {
		return new Response(JSON.stringify({ error: "Failed to fetch outer page" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const preloadMatch = pageHTML.match(/window\.preloadPage\s*=\s*\w+\("([^"]+)"/);
	  if (!preloadMatch) {
		return new Response(JSON.stringify({ error: "Could not find preloadPage URL" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const preloadUrl = preloadMatch[1];
	  let mdContent;
  
	  try {
		const preloadRes = await fetch(preloadUrl);
		mdContent = await preloadRes.text();
	  } catch (err) {
		return new Response(JSON.stringify({ error: "Failed to fetch .md content" }), {
		  status: 500,
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		});
	  }
  
	  const clean = mdContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
	  const strictRegex = /lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i;
	  const footnoteRegex = /\[\^\w+]:\s*lexDef\s*{usage:::+\s*([^}]+)}\s*(.*?)\s*(?=\[\^|\n|$)/i;
  
	  let term = null;
	  let usageTypes: string[] = [];
	  let potency = 0;
	  let fallback = null;
  
	  const match = clean.match(strictRegex);
  
	  if (match) {
		term = match[1];
		const usageBlock = match[2];
		usageTypes = usageBlock.split("||").map((u) => u.trim());
		potency = usageTypes.length;
	  } else {
		const footnoteMatch = clean.match(footnoteRegex);
		if (footnoteMatch) {
		  usageTypes = footnoteMatch[1].split("||").map((u) => u.trim());
		  potency = usageTypes.length;
		  fallback = footnoteMatch[2].trim();
		} else {
		  const loose = clean.match(/[^.?!]*\blexDef\b[^.?!]*[.?!]/i);
		  if (loose) {
			fallback = loose[0].trim();
		  } else {
			// No lexDef *at all*, return fallback as entire .md file (cleaned)
			fallback = clean.slice(0, 2000); // truncate for safety
		  }
		}
	  }
  
	  const valency = [...clean.matchAll(/lexDef\s+/g)].length;
	  const links = [...mdContent.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  
	  return new Response(
		JSON.stringify({
		  term,
		  usageTypes,
		  potency,
		  valency,
		  fallback,
		  coordinate: preloadUrl,
		  links,
		  content: clean.slice(0, 5000) // limit to prevent overload
		}),
		{
		  headers: { "Content-Type": "application/json", ...corsHeaders },
		}
	  );
	},
  };