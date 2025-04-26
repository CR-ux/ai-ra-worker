const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let indexData: Record<string, string> = {};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }//test

    if (Object.keys(indexData).length === 0) {
      try {
		const res = await fetch('https://raw.githubusercontent.com/CR-ux/ai-ra-worker/main/index.json');        if (!res.ok) throw new Error("Failed to fetch index.json");
        indexData = await res.json();
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch index.json" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q");
    const query = decodeURIComponent((rawQuery || "").trim().replace(/^\/+|\/+$/g, ""));

    if (!query) {
      return new Response(JSON.stringify({ error: "No query provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resolvedPath = indexData[query] || `${query}.md`;
    const rawUrl = `https://raw.githubusercontent.com/CR-ux/THE-VAULT/main/${resolvedPath}`;
    let mdContent = "";

    try {
      const mdRes = await fetch(rawUrl);
      if (!mdRes.ok) throw new Error("Failed to fetch markdown file");
      mdContent = await mdRes.text();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch file" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const shortContent = mdContent.slice(0, 144000) + "\n{REDACTED}";
    const links = [...mdContent.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);

    const allLexDefs = [...mdContent.matchAll(/lexDef\s+"([^"]+)"\s+{usage:::\s+([^}]+)}/g)];
    let totalPotency = 0;
    for (const match of allLexDefs) {
      const usagePart = match[2];
      const usageList = usagePart.split("||").map(u => u.trim());
      totalPotency += usageList.length;
    }

    return new Response(JSON.stringify({
      term: query,
      usageTypes: [],
      potency: totalPotency,
      concentration: allLexDefs.length,
      valency: (mdContent.match(/lexDef\s+/g) || []).length,
      fallback: shortContent,
      fall: shortContent,
      markdown: shortContent,
      coordinate: rawUrl,
      links,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  },
};