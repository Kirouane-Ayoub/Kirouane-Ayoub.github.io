document.addEventListener("DOMContentLoaded", () => {
    // Load projects
    fetch("content.md")
        .then(r => r.text())
        .then(md => {
            const container = document.getElementById("projects-list");
            if (!container) return;

            const entries = md.split('\n')
                .filter(line => line.startsWith('- ['))
                .map(line => {
                    const match = line.match(/- \[(.*?)\]\((.*?)\):\s*(.*?)\.\s*\[(.*?)\]/);
                    if (!match) return null;
                    const [, title, url, , tags] = match;
                    return { title, url, tags };
                })
                .filter(Boolean);

            container.innerHTML = entries.map(e => `
                <a href="${e.url}" target="_blank" class="entry">
                    <span class="entry-title">${e.title}</span>
                    <span class="entry-tags">${e.tags}</span>
                </a>
            `).join('');
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
                    <span class="entry-title">${e.title}</span>
                    <img class="entry-thumb" src="${e.img}" alt="${e.title}" loading="lazy">
                </a>
            `).join('');
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
                        <span class="entry-title">${e.title}</span>
                        ${e.img ? `<img class="entry-thumb" src="${e.img}" alt="${e.title}" loading="lazy">` : ''}
                    </a>
                `).join('');
            });
        });
});
