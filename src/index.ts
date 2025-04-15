export default {
	async fetch(request: Request): Promise<Response> {
		console.log(">>> AI:RA WORKER ONLINE <<<");

		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q");

		if (!query) {
			return new Response(JSON.stringify({ error: "No query provided" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const targetUrl = `https://www.carpvs.com/${query}`;
		let html;

		try {
			const res = await fetch(targetUrl);
			html = await res.text();
		} catch (err) {
			console.error("FETCH ERROR:", err);
			return new Response(JSON.stringify({ error: "Failed to fetch page" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Extract content inside <main>, fallback to full HTML
		const mainText = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
		const clean = mainText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
		console.log("CLEANED TEXT SAMPLE:\n", clean.slice(0, 1000));

		// Match the lexDef line and count usage entries
		const lexDefRegex = /lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i;
		const match = clean.match(lexDefRegex);

		if (!match) {
			console.log("❌ No lexDef matched in cleaned text.");
			return new Response(JSON.stringify({ error: "No lexDef found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const term = match[1];
		const usageBlock = match[2];
		const usageTypes = usageBlock.split("||").map(u => u.trim());
		const potency = usageTypes.length;

		console.log(`✅ Found lexDef "${term}" with ${potency} usage(s):`, usageTypes);

		return new Response(
			JSON.stringify({
				term,
				usageTypes,
				potency,
				coordinate: targetUrl,
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	},
};