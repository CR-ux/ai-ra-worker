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

		const outerUrl = `https://www.carpvs.com/${query}`;
		let pageHTML;

		try {
			const outerRes = await fetch(outerUrl);
			pageHTML = await outerRes.text();
		} catch (err) {
			console.error("FETCH ERROR (outer):", err);
			return new Response(JSON.stringify({ error: "Failed to fetch outer page" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// 🔍 Extract preloadPage .md URL
		const preloadMatch = pageHTML.match(/window\.preloadPage\s*=\s*fetch\("([^"]+)"/);
		if (!preloadMatch) {
			console.error("Could not find preloadPage URL");
			return new Response(JSON.stringify({ error: "Could not find preloadPage URL" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
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
				headers: { "Content-Type": "application/json" },
			});
		}

		// 🚿 Scrub the content
		const clean = mdContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
		console.log("CLEANED MD SAMPLE:\n", clean.slice(0, 1000));

		// 📚 Match lexDef line
		const lexDefRegex = /lexDef\s+"([^"]+)"\s+{usage:::+\s*([^}]+)}/i;
		const match = clean.match(lexDefRegex);

		if (!match) {
			console.log("❌ No lexDef matched in .md content.");
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
				coordinate: preloadUrl,
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	},
};