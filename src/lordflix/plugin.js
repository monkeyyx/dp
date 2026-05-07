(function() {
    if (typeof fetch === 'undefined') {
        globalThis.fetch = async function(url, options = {}) {
            return new Promise((resolve) => {
                const method = (options.method || 'GET').toUpperCase();
                const headers = options.headers || {};
                const body = options.body;
                const callback = (res) => {
                    resolve({
                        ok: res.status >= 200 && res.status < 300,
                        status: res.status,
                        json: async () => typeof res.body === 'string' ? JSON.parse(res.body) : res.body,
                        text: async () => typeof res.body === 'string' ? res.body : JSON.stringify(res.body),
                        headers: { get: (name) => { const key = Object.keys(res.headers || {}).find(k => k.toLowerCase() === name.toLowerCase()); return key ? res.headers[key] : null; } }
                    });
                };
                if (method === 'POST') http_post(url, headers, body, callback);
                else http_get(url, headers, callback);
            });
        };
    }

    const RIVE_BASE = "https://rives.top";
    const VIDSRC_BASE = "https://vidsrc.to";
    const PROXY_BASE = "https://moviebox.s4nch1tt.workers.dev/proxy?url=";

    function wrapProxy(url) {
        if (!url || url.includes('.m3u8')) return url;
        return PROXY_BASE + encodeURIComponent(url);
    }

    function generateSecretKey(id) {
        const c = ["4Z7lUo","gwIVSMD","PLmz2elE2v","Z4OFV0","SZ6RZq6Zc","zhJEFYxrz8","FOm7b0","axHS3q4KDq","o9zuXQ","4Aebt","wgjjWwKKx","rY4VIxqSN","kfjbnSo","2DyrFA1M","YUixDM9B","JQvgEj0","mcuFx6JIek","eoTKe26gL","qaI9EVO1rB","0xl33btZL","1fszuAU","a7jnHzst6P","wQuJkX","cBNhTJlEOf","KNcFWhDvgT","XipDGjST","PCZJlbHoyt","2AYnMZkqd","HIpJh","KH0C3iztrG","W81hjts92","rJhAT","NON7LKoMQ","NMdY3nsKzI","t4En5v","Qq5cOQ9H","Y9nwrp","VX5FYVfsf","cE5SJG","x1vj1","HegbLe","zJ3nmt4OA","gt7rxW57dq","clIE9b","jyJ9g","B5jXjMCSx","cOzZBZTV","FTXGy","Dfh1q1","ny9jqZ2POI","X2NnMn","MBtoyD","qz4Ilys7wB","68lbOMye","3YUJnmxp","1fv5Imona","PlfvvXD7mA","ZarKfHCaPR","owORnX","dQP1YU","dVdkx","qgiK0E","cx9wQ","5F9bGa","7UjkKrp","Yvhrj","wYXez5Dg3","pG4GMU","MwMAu","rFRD5wlM"];
        if (id === undefined) return "rive";
        try {
            let t, n; const r = String(id);
            if (isNaN(Number(id))) {
                const sum = r.split("").reduce((e, ch) => e + ch.charCodeAt(0), 0);
                t = c[sum % c.length]; n = Math.floor((sum % r.length) / 2);
            } else {
                const num = Number(id);
                t = c[num % c.length]; n = Math.floor((num % r.length) / 2);
            }
            const i = r.slice(0, n) + t + r.slice(n);
            const innerHash = (e) => {
                let t = 0 >>> 0;
                for (let n = 0; n < e.length; n++) {
                    const r = e.charCodeAt(n);
                    const i = (((t = (r + (t << 6) + (t << 16) - t) >>> 0) << n % 5) | (t >>> (32 - (n % 5)))) >>> 0;
                    t = (t ^ (i ^ (((r << n % 7) | (r >>> (8 - (n % 7)))) >>> 0))) >>> 0;
                    t = (t + ((t >>> 11) ^ (t << 3))) >>> 0;
                }
                t ^= t >>> 15; t = ((t & 65535) * 49842 + ((((t >>> 16) * 49842) & 65535) << 16)) >>> 0;
                t ^= t >>> 13; t = ((t & 65535) * 40503 + ((((t >>> 16) * 40503) & 65535) << 16)) >>> 0;
                t ^= t >>> 16; return t.toString(16).padStart(8, "0");
            };
            const outerHash = (e) => {
                let n = (3735928559 ^ e.length) >>> 0;
                for (let idx = 0; idx < e.length; idx++) {
                    let r = e.charCodeAt(idx);
                    r ^= ((131 * idx + 89) ^ (r << idx % 5)) & 255;
                    n = (((n << 7) | (n >>> 25)) >>> 0) ^ r;
                    const i = ((n & 65535) * 60205) >>> 0; const o = (((n >>> 16) * 60205) << 16) >>> 0;
                    n = (i + o) >>> 0; n ^= n >>> 11;
                }
                n ^= n >>> 15; n = (((n & 65535) * 49842 + (((n >>> 16) * 49842) << 16)) >>> 0) >>> 0;
                n ^= n >>> 13; n = (((n & 65535) * 40503 + (((n >>> 16) * 40503) << 16)) >>> 0) >>> 0;
                n ^= n >>> 16; n = (((n & 65535) * 10196 + (((n >>> 16) * 10196) << 16)) >>> 0) >>> 0;
                n ^= n >>> 15; return n.toString(16).padStart(8, "0");
            };
            return btoa(outerHash(innerHash(i)));
        } catch (e) { return "rive"; }
    }

    async function getHome(cb) { cb({ success: true, data: {} }); }
    async function search(query, cb) { cb({ success: true, data: [] }); }
    async function load(url, cb) { cb({ success: true, data: {} }); }

    async function loadStreams(url, cb) {
        try {
            if (!url.startsWith("tmdb:")) return cb({ success: false, message: "Invalid URL" });
            const parts = url.split(":");
            const tmdbId = parts[1];
            const mediaType = parts[2] === 'series' ? 'tv' : 'movie';
            const season = parts[3] || "1";
            const episode = parts[4] || "1";

            const results = [];

            // 1. Rive Backend
            try {
                const secret = generateSecretKey(tmdbId);
                const servers = ["lordflix", "panda", "cherry", "shadow"];
                const route = mediaType === "tv" 
                    ? `/api/backendfetch?requestID=tvVideoProvider&id=${tmdbId}&season=${season}&episode=${episode}&secretKey=${secret}&service=`
                    : `/api/backendfetch?requestID=movieVideoProvider&id=${tmdbId}&secretKey=${secret}&service=`;

                for (const server of servers) {
                    try {
                        const resp = await fetch(`${RIVE_BASE}${route}${server}`);
                        const json = await resp.json();
                        if (json.data?.sources) {
                            json.data.sources.forEach(s => {
                                results.push(new StreamResult({
                                    source: `LordFlix (${server})`,
                                    url: wrapProxy(s.url),
                                    quality: s.quality || 'Auto',
                                    headers: { Referer: RIVE_BASE }
                                }));
                            });
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            // 2. VidSrc AJAX Resolution (The block you mentioned)
            try {
                const embedUrl = mediaType === 'tv' 
                    ? `${VIDSRC_BASE}/embed/tv/${tmdbId}/${season}/${episode}`
                    : `${VIDSRC_BASE}/embed/movie/${tmdbId}`;

                // Step A: Get the embed page with LordFlix Referer
                const res = await fetch(embedUrl, {
                    headers: { Referer: "https://lordflix.org/" }
                });
                const html = await res.text();

                // Step B: Extract data-hash using regex (since we don't have cheerio in raw plugin.js)
                const hashRegex = /data-hash="([^"]+)"[^>]*>([^<]+)/g;
                let match;
                while ((match = hashRegex.exec(html)) !== null) {
                    const dataHash = match[1];
                    const serverName = match[2].trim();

                    try {
                        // Step C: Call the AJAX sources endpoint
                        const sourceUrl = `${VIDSRC_BASE}/ajax/embed/episode/${dataHash}/sources`;
                        const sourceRes = await fetch(sourceUrl, {
                            headers: {
                                Referer: embedUrl,
                                "X-Requested-With": "XMLHttpRequest"
                            }
                        });
                        const sourceData = await sourceRes.json();
                        if (sourceData?.result?.url) {
                            results.push(new StreamResult({
                                source: `LordFlix-VidSrc-${serverName}`,
                                url: sourceData.result.url,
                                quality: "HD",
                                headers: { Referer: VIDSRC_BASE }
                            }));
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            const filteredData = (globalThis.platform === "ios") ? results.filter(s => s.type !== "embed") : results; cb({ success: true, data: filteredData });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
