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

    // Load publications from arXiv (auto-updates when new papers are published).
    // Paper list + thumbnails are cached in localStorage: repeat visits render
    // instantly and survive arXiv API downtime/rate limits.
    const renderPapers = papers => {
        const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
        document.getElementById("papers-list").innerHTML = papers.map(p => `
            <a href="${p.absUrl}" target="_blank" class="entry">
                <img class="paper-thumb" data-id="${p.id}" alt="" loading="lazy">
                <span class="entry-title">${esc(p.title)}</span>
                <span class="entry-meta">arXiv · ${p.year}</span>
                <span class="entry-desc">${esc(p.summary)}</span>
            </a>
        `).join('');
        document.getElementById("papers-section").hidden = false;
        addRowNav(document.getElementById("papers-list"));

        // First-page thumbnails: from cache, else rendered once with pdf.js
        const missing = [];
        papers.forEach(p => {
            const data = localStorage.getItem("thumb:" + p.id);
            if (data) document.querySelector(`img[data-id="${p.id}"]`).src = data;
            else missing.push(p);
        });
        if (!missing.length) return;

        import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs").then(async pdfjs => {
            pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
            for (const p of missing) {
                try {
                    const pdf = await pdfjs.getDocument(p.pdfUrl).promise;
                    const page = await pdf.getPage(1);
                    const scale = 160 / page.getViewport({ scale: 1 }).width;
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

    const cachedPapers = JSON.parse(localStorage.getItem("papers-v1") || "null");
    if (cachedPapers && cachedPapers.length) renderPapers(cachedPapers);

    fetch("https://export.arxiv.org/api/query?search_query=au:%22Kirouane%22&sortBy=submittedDate&sortOrder=descending&max_results=50")
        .then(r => r.text())
        .then(xml => {
            const doc = new DOMParser().parseFromString(xml, "text/xml");
            const papers = [...doc.querySelectorAll("entry")]
                .filter(e => [...e.querySelectorAll("author name")]
                    .some(n => /ayoub\s+kirouane|kirouane,?\s+ayoub/i.test(n.textContent)))
                .map(e => {
                    const absUrl = e.querySelector("id").textContent.trim().replace("http://", "https://");
                    return {
                        id: absUrl.split("/abs/")[1].replace(/v\d+$/, ""),
                        absUrl,
                        pdfUrl: absUrl.replace("/abs/", "/pdf/"),
                        title: e.querySelector("title").textContent.replace(/\s+/g, " ").trim(),
                        summary: e.querySelector("summary").textContent.replace(/\s+/g, " ").trim(),
                        year: e.querySelector("published").textContent.slice(0, 4),
                    };
                });
            if (!papers.length) return;
            try { localStorage.setItem("papers-v1", JSON.stringify(papers)); } catch {}
            if (JSON.stringify(papers) !== JSON.stringify(cachedPapers)) renderPapers(papers);
        })
        .catch(() => {});

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
