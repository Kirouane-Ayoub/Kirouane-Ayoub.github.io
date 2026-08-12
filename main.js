document.addEventListener("DOMContentLoaded", () => {
    // Small ← → controls under each horizontal row; hidden when the row fits
    const addRowNav = row => {
        if (!row || (row.nextElementSibling && row.nextElementSibling.classList.contains("row-nav"))) return;
        const nav = document.createElement("div");
        nav.className = "row-nav";
        nav.innerHTML = '<button type="button" aria-label="scroll left">←</button><button type="button" aria-label="scroll right">→</button>';
        row.after(nav);
        nav.children[0].onclick = () => row.scrollBy({ left: -row.clientWidth * 0.8, behavior: "smooth" });
        nav.children[1].onclick = () => row.scrollBy({ left: row.clientWidth * 0.8, behavior: "smooth" });
        const update = () => { nav.style.display = row.scrollWidth > row.clientWidth + 4 ? "" : "none"; };
        update();
        window.addEventListener("resize", update);
    };

    // Publications, fully dynamic: arXiv (real-time but occasionally down) and
    // OpenAlex (fast and reliable but indexes new papers late) are queried in
    // parallel and merged — whichever answers first paints the section.
    // Thumbnails are rendered in-browser from the PDFs and cached per visitor.
    const renderPapers = papers => {
        const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
        document.getElementById("papers-list").innerHTML = papers.map(p => `
            <a href="${p.absUrl}" target="_blank" class="entry">
                <img class="paper-thumb" data-id="${p.id}" alt="">
                <span class="entry-title">${esc(p.title)}</span>
                <span class="entry-meta">arXiv · ${p.year}</span>
                <span class="entry-desc">${esc(p.summary)}</span>
            </a>
        `).join('');
        papers.forEach(p => {
            const data = localStorage.getItem("thumb:" + p.id);
            if (data) document.querySelector(`img[data-id="${p.id}"]`).src = data;
        });
        document.getElementById("papers-section").hidden = false;
        addRowNav(document.getElementById("papers-list"));
    };

    const shown = new Map();
    const mergePapers = papers => {
        let changed = false;
        for (const p of papers) if (!shown.has(p.id)) { shown.set(p.id, p); changed = true; }
        if (!changed) return;
        // ponytail: post-2007 arXiv ids (YYMM.NNNNN) sort chronologically as strings
        const all = [...shown.values()].sort((a, b) => b.id.localeCompare(a.id));
        renderPapers(all);
        fillThumbs(all.filter(p => !localStorage.getItem("thumb:" + p.id)));
    };

    // Note: arXiv's own query API sends no CORS headers, so it can't be called
    // from a browser — these two both can, and both index all arXiv papers.
    const arxivIdOf = w => {
        const url = ((w.primary_location || {}).landing_page_url || "") + " " + (w.doi || "");
        const m = url.match(/arxiv(?:\.org\/abs\/|\.)(\d{4}\.\d{4,5})/i);
        return m ? m[1] : null;
    };

    fetch("https://api.openalex.org/works?filter=raw_author_name.search:ayoub%20kirouane&sort=publication_date:desc&per-page=50")
        .then(r => r.json())
        .then(d => {
            const deinvert = inv => {
                if (!inv) return "";
                const words = [];
                for (const [w, positions] of Object.entries(inv))
                    for (const pos of positions) words[pos] = w;
                return words.join(" ");
            };
            mergePapers(d.results
                .map(w => ({ w, id: arxivIdOf(w) }))
                .filter(x => x.id)
                .map(({ w, id }) => ({
                    id,
                    absUrl: `https://arxiv.org/abs/${id}`,
                    pdfUrl: `https://arxiv.org/pdf/${id}`,
                    title: w.display_name,
                    summary: deinvert(w.abstract_inverted_index),
                    year: String(w.publication_year),
                })));
        })
        .catch(() => {});

    fetch("https://api.semanticscholar.org/graph/v1/author/2454421288/papers?fields=title,abstract,year,externalIds&limit=100")
        .then(r => r.json())
        .then(d => {
            mergePapers((d.data || [])
                .filter(p => (p.externalIds || {}).ArXiv)
                .map(p => {
                    const id = p.externalIds.ArXiv;
                    return {
                        id,
                        absUrl: `https://arxiv.org/abs/${id}`,
                        pdfUrl: `https://arxiv.org/pdf/${id}`,
                        title: p.title,
                        summary: p.abstract || "",
                        year: String(p.year || ""),
                    };
                }));
        })
        .catch(() => {});

    const thumbsInFlight = new Set();
    const fillThumbs = papers => {
        papers = papers.filter(p => !thumbsInFlight.has(p.id));
        if (!papers.length) return;
        papers.forEach(p => thumbsInFlight.add(p.id));
        import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs").then(async pdfjs => {
            pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
            for (const p of papers) {
                try {
                    const pdf = await pdfjs.getDocument(p.pdfUrl).promise;
                    const page = await pdf.getPage(1);
                    const scale = 480 / page.getViewport({ scale: 1 }).width;
                    const vp = page.getViewport({ scale });
                    const canvas = document.createElement("canvas");
                    canvas.width = vp.width;
                    canvas.height = vp.height;
                    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
                    const data = canvas.toDataURL("image/jpeg", 0.8);
                    try { localStorage.setItem("thumb:" + p.id, data); } catch {}
                    const img = document.querySelector(`img[data-id="${p.id}"]`);
                    if (img) img.src = data;
                    pdf.destroy();
                } catch {} // ponytail: no thumbnail on failure, entry still renders
            }
        }).catch(() => {});
    };

    // Load projects, grouped by the ### headings in content.md
    fetch("content.md")
        .then(r => r.text())
        .then(md => {
            const container = document.getElementById("projects-list");
            if (!container) return;

            const groups = [];
            for (const line of md.split('\n')) {
                if (line.startsWith('### ')) {
                    groups.push({ name: line.slice(4).trim(), entries: [] });
                } else if (line.startsWith('- [')) {
                    const match = line.match(/- \[(.*?)\]\((.*?)\):\s*(.*?)\.?\s*\[(.*?)\]/);
                    if (!match) continue;
                    const [, title, url, desc, tags] = match;
                    if (!groups.length) groups.push({ name: '', entries: [] });
                    groups[groups.length - 1].entries.push({ title, url, tags, desc: desc.replace(/\s*\.*\s*$/, '') });
                }
            }

            container.innerHTML = groups.map(g => `
                ${g.name ? `<h3 class="group-label">${g.name}</h3>` : ''}
                <div class="entry-list">
                    ${g.entries.map(e => `
                        <a href="${e.url}" target="_blank" class="entry">
                            <span class="entry-title">${e.title}</span>
                            <span class="entry-desc">${e.desc}.</span>
                            <span class="entry-tags">${e.tags}</span>
                        </a>
                    `).join('')}
                </div>
            `).join('');
            container.querySelectorAll(".entry-list").forEach(addRowNav);
        });

    // Load blog posts
    fetch("blog.md")
        .then(r => r.text())
        .then(md => {
            const container = document.getElementById("blog-list");
            if (!container) return;

            const entries = md.split('\n')
                .filter(line => line.startsWith('- ['))
                .map(line => {
                    const match = line.match(/- \[(.*?)\]\((.*?)\)\s*\|\s*(.*)/);
                    if (!match) return null;
                    const [, title, url, img] = match;
                    return { title, url, img: img.trim() };
                })
                .filter(Boolean);

            container.innerHTML = entries.map(e => `
                <a href="${e.url}" target="_blank" class="entry">
                    <img class="blog-thumb" src="${e.img}" alt="${e.title}" loading="lazy">
                    <span class="entry-title">${e.title}</span>
                </a>
            `).join('');
            addRowNav(container);
        });

    // Load TikTok videos
    fetch("tiktok.md")
        .then(r => r.text())
        .then(md => {
            const container = document.getElementById("tiktok-list");
            if (!container) return;

            const entries = md.split('\n')
                .filter(line => line.startsWith('- ['))
                .map(line => {
                    const match = line.match(/- \[(.*?)\]\((.*?)\)/);
                    if (!match) return null;
                    const [, title, url] = match;
                    return { title, url };
                })
                .filter(Boolean);

            Promise.all(entries.map(e =>
                fetch(`https://www.tiktok.com/oembed?url=${e.url}`)
                    .then(r => r.json())
                    .then(data => ({ ...e, img: data.thumbnail_url }))
                    .catch(() => ({ ...e, img: '' }))
            )).then(results => {
                container.innerHTML = results.map(e => `
                    <a href="${e.url}" target="_blank" class="entry">
                        ${e.img ? `<img class="entry-thumb" src="${e.img}" alt="${e.title}" loading="lazy">` : ''}
                        <span class="entry-title">${e.title}</span>
                    </a>
                `).join('');
                addRowNav(container);
            });
        });
});
