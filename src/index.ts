export default {
	async fetch(request: Request): Promise<Response> {
	  const { searchParams } = new URL(request.url);
	  const query = searchParams.get("q");
  
	  if (!query) {
		return new Response(JSON.stringify({ error: "No query provided" }), {
		  status: 400,
		  headers: { "Content-Type": "application/json" },
		});
	  }
  
	  const targetUrl = `https://www.carpvs.com/${query}`;
	  const res = await fetch(targetUrl);
	  const html = await res.text();
  
	  // Strip tags or get the content inside <main> or <body>
	  const mainText = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
	  const clean = mainText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  
	  // Match the lexDef and its parts
	  const lexDefRegex = /lexDef\s+"(.*?)"\s+{usage:::+\s*(\w+)\s*}\s*<\s*N\.B\.\s*"([^"]+)"\[\^([^\]]+)]/i;	  const lexMatch = clean.match(lexDefRegex);
  
	  if (!lexMatch) {
		return new Response(JSON.stringify({ error: "No lexDef found" }), {
		  status: 404,
		  headers: { "Content-Type": "application/json" },
		});
	  }
  
	  const [, term, usage, definition, footnoteKey] = lexMatch;
  
	  // Now extract the corresponding footnote
	  const footnoteRegex = new RegExp(`\$begin:math:display$\\\\^${footnoteKey}]:\\\\s+\\\\[\\\\[(.*?)\\$end:math:display$\\],\\s*(.*?),\\s*(\\d{4})`, "i");
	  const footnoteMatch = clean.match(footnoteRegex);
  
	  let source = null;
	  if (footnoteMatch) {
		const [, quote, author, year] = footnoteMatch;
		source = { quote, author, year: parseInt(year) };
	  }
  
	  return new Response(
		JSON.stringify({
		  term,
		  usage,
		  definition,
		  source,
		  coordinate: targetUrl,
		}),
		{ headers: { "Content-Type": "application/json" } }
	  );
	},
  };