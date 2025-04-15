export default {
	async fetch(request: Request): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type"
				}
			});
		}

		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q");

		if (!query) {
			return new Response(JSON.stringify({ error: "No query provided" }), {
				status: 400,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		const outerUrl = `https://www.carpvs.com/${query}`;
		let pageHTML;

		try {
			const outerRes = await fetch(outerUrl);
			pageHTML = await outerRes.text();
		} catch (err) {
			console.error("FETCH ERROR (outer):", err);
			return new Response(JSON.stringify({ error: "Failed to fetch outer page" }), {
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		const preloadMatch = pageHTML.match(/window\.preloadPage\s*=\s*\w+\("([^"]+)"/);
		if (!preloadMatch) {
			console.error("Could not find preloadPage URL");
			return new Response(JSON.stringify({ error: "Could not find preloadPage URL" }), {
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		const preloadUrl = preloadMatch[1];
		let mdContent;

		try {
			const preloadRes = await fetch(preloadUrl);
			mdContent = await preloadRes.text();
		} catch (err) {
			console.error("FETCH ERROR (preload):", err);
			return new Response(JSON.stringify({ error: "Failed to fetch .md content" }), {
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		const clean = mdContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
		const lexDefRegex = /lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i;
		const match = clean.match(lexDefRegex);

		if (!match) {
			return new Response(JSON.stringify({ error: "No lexDef found" }), {
				status: 404,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		const term = match[1];
		const usageBlock = match[2];
		const usageTypes = usageBlock.split("||").map(u => u.trim());
		const potency = usageTypes.length;

		return new Response(
			JSON.stringify({
				term,
				usageTypes,
				potency,
				coordinate: preloadUrl
			}),
			{
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			}
		);
	}
};