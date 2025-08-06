document.addEventListener("DOMContentLoaded", () => {
    const themeToggler = document.getElementById("theme-toggler");
    const body = document.body;

    // --- Theme Management ---
    const savedTheme = localStorage.getItem("theme") || "dark-mode";
    body.className = savedTheme;
    themeToggler.textContent = savedTheme === "dark-mode" ? "☀️" : "🌙";

    themeToggler.addEventListener("click", () => {
        const newTheme = body.classList.contains("dark-mode") ? "light-mode" : "dark-mode";
        body.className = newTheme;
        localStorage.setItem("theme", newTheme);
        themeToggler.textContent = newTheme === "dark-mode" ? "☀️" : "🌙";
        updateParticleColors(newTheme);
    });

    // --- Typing Animation ---
    function typewriter(elementId, text, speed) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerText = ""; // Clear the element first
        let i = 0;

        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    const bioElement = document.getElementById("bio");
    if (bioElement) {
        const bioText = "I build intelligent systems from scratch.";
        // Use a speed of ~60ms for a more deliberate streaming feel
        typewriter("bio", bioText, 60);
    }

    const aboutElement = document.getElementById("about-text");
    if(aboutElement) {
        const aboutText = aboutElement.innerText;
        aboutElement.innerText = ''; // Clear it first
        // Use a slightly faster speed for the longer text
        typewriter("about-text", aboutText, 45);
    }

    // --- Dynamic Content Loading ---
    const projectsContainer = document.getElementById("projects-container");
    if (projectsContainer) {
        fetch("content.md")
            .then(response => response.text())
            .then(markdown => {
                const projects = markdown.split('\n')
                    .filter(line => line.startsWith('- ['))
                    .map(line => {
                        const match = line.match(/- \[(.*?)\]\((.*?)\): (.*?)\. \[(.*?)\]/);
                        if (!match) return null;
                        const [, title, url, description, tagsStr] = match;
                        const tags = tagsStr.split(',').map(tag => tag.trim());
                        return { title, url, description, tags };
                    })
                    .filter(p => p !== null);

                projectsContainer.innerHTML = projects.map(p => `
                    <a href="${p.url}" target="_blank" class="card">
                        <div class="card-content">
                            <h3 class="card-title">${p.title}</h3>
                            <p class="card-description">${p.description}</p>
                            <div class="card-tags">
                                ${p.tags.map(tag => `<span class="card-tag">${tag}</span>`).join('')}
                            </div>
                        </div>
                    </a>
                `).join('');
            });
    }

    const blogContainer = document.getElementById("blog-container");
    if (blogContainer) {
        fetch("blog.md")
            .then(response => response.text())
            .then(markdown => {
                const posts = markdown.split('\n')
                    .filter(line => line.startsWith('- ['))
                    .map(line => {
                        const match = line.match(/- \[(.*?)\]\((.*?)\) \| (.*)/);
                        if (!match) return null;
                        const [, title, url, imgSrc] = match;
                        return { title, url, imgSrc };
                    })
                    .filter(p => p !== null);

                blogContainer.innerHTML = posts.map(post => `
                    <a href="${post.url}" target="_blank" class="card">
                        <div class="card-img-container">
                            <img src="${post.imgSrc}" alt="${post.title}" loading="lazy">
                        </div>
                        <div class="card-content">
                            <h3 class="card-title">${post.title}</h3>
                        </div>
                    </a>
                `).join('');
            });
    }

    const tiktokContainer = document.getElementById("tiktok-container");
    if (tiktokContainer) {
        fetch("tiktok.md")
            .then(response => response.text())
            .then(markdown => {
                const tiktokPromises = markdown.split('\n')
                    .filter(line => line.startsWith('- ['))
                    .map(line => {
                        const match = line.match(/- \[(.*?)\]\((.*?)\)/);
                        if (!match) return null;
                        const [, title, url] = match;
                        return { title, url };
                    })
                    .filter(p => p !== null)
                    .map(tiktok => {
                        return fetch(`https://www.tiktok.com/oembed?url=${tiktok.url}`)
                            .then(response => response.json())
                            .then(data => {
                                return { ...tiktok, imgSrc: data.thumbnail_url };
                            })
                            .catch(() => {
                                // Fallback to a placeholder if the API fails
                                return { ...tiktok, imgSrc: `https://placehold.co/300x400/00aaff/e0e0e0?text=TikTok` };
                            });
                    });

                Promise.all(tiktokPromises)
                    .then(tiktoks => {
                        tiktokContainer.innerHTML = tiktoks.map(tiktok => `
                            <a href="${tiktok.url}" target="_blank" class="card">
                                <div class="card-img-container">
                                    <img src="${tiktok.imgSrc}" alt="${tiktok.title}" loading="lazy">
                                </div>
                                <div class="card-content">
                                    <h3 class="card-title">${tiktok.title}</h3>
                                </div>
                            </a>
                        `).join('');
                    });
            });
    }
    // --- Particles.js Setup ---
    const particlesConfig = {
        dark: {
            particles: {
                number: { value: 50 },
                color: { value: "#00aaff" },
                shape: { type: "circle" },
                opacity: { value: 0.3, random: true },
                size: { value: 2, random: true },
                line_linked: { enable: true, distance: 150, color: "#00aaff", opacity: 0.2, width: 1 },
                move: { enable: true, speed: 1, direction: "none", out_mode: "out" }
            },
            interactivity: { events: { onhover: { enable: true, mode: "repulse" } } }
        },
        light: {
            particles: {
                number: { value: 50 },
                color: { value: "#0056b3" },
                shape: { type: "circle" },
                opacity: { value: 0.4, random: true },
                size: { value: 2, random: true },
                line_linked: { enable: true, distance: 150, color: "#0056b3", opacity: 0.3, width: 1 },
                move: { enable: true, speed: 1, direction: "none", out_mode: "out" }
            },
            interactivity: { events: { onhover: { enable: true, mode: "repulse" } } }
        }
    };

    function updateParticleColors(theme) {
        const config = theme === 'dark-mode' ? particlesConfig.dark : particlesConfig.light;
        if (window.particlesJS) {
            particlesJS("particles-js", config);
        }
    }

    updateParticleColors(savedTheme);
});