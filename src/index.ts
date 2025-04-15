export default {
	async fetch(request: Request): Promise<Response> {
	  const url = new URL(request.url);
	  const q = url.searchParams.get("q") || "index";
  
	  const targetUrl = `https://carpvs.com/${q}`;
  
	  try {
		const res = await fetch(targetUrl);
		const html = await res.text();
  
		// Snip the first 300 characters of raw HTML as a teaser
		const snippet = html.substring(0, 300);
  
		return new Response(
		  JSON.stringify({
			coordinate: targetUrl,
			snippet
		  }),
		  { headers: { "Content-Type": "application/json" } }
		);
	  } catch (e) {
		return new Response(
		  JSON.stringify({
			error: "Failed to fetch Book",
			coordinate: targetUrl
		  }),
		  { status: 500, headers: { "Content-Type": "application/json" } }
		);
	  }
	},
  };