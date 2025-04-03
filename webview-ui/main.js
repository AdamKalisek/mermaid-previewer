// Knihovny mermaid a Canvg jsou nyní načítány z CDN v index.html

// Získání přístupu k VS Code API pro komunikaci mezi webview a extensí
// Tuto funkci lze volat pouze jednou
const vscode = acquireVsCodeApi();

// Reference na HTML elementy
const mermaidInput = document.getElementById('mermaid-input');
// const previewButton = document.getElementById('preview-button'); // Odstraněno
const downloadSvgButton = document.getElementById('download-svg-button');
const downloadPngButton = document.getElementById('download-png-button');
const previewArea = document.getElementById('preview-area');
const errorArea = document.getElementById('error-area');
const pngCanvas = document.getElementById('png-canvas');

let currentSvgContent = ''; // Proměnná pro uložení posledního vygenerovaného SVG

// --- Posluchače událostí ---

// previewButton.addEventListener('click', () => { // Odstraněno
//     const mermaidCode = mermaidInput.value;
//     renderPreview(mermaidInput.value); // Předáme aktuální hodnotu
// });

// Listener pro změnu v textarea pro živější náhled
let debounceTimeout;
mermaidInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const currentInput = mermaidInput.value;
        renderPreview(currentInput);
        // Pošleme aktuální vstup do extense k uložení
        vscode.postMessage({ command: 'saveInput', data: currentInput });
    }, 500); // Malá prodleva pro snížení zátěže
});


downloadSvgButton.addEventListener('click', () => {
    if (currentSvgContent) {
        vscode.postMessage({
            command: 'downloadSvg',
            data: currentSvgContent
        });
    } else {
        showError('Nejdříve vygenerujte náhled (Preview).');
    }
});

downloadPngButton.addEventListener('click', () => {
    if (currentSvgContent) {
        generateAndDownloadPng(currentSvgContent);
    } else {
        showError('Nejdříve vygenerujte náhled (Preview).');
    }
});

// --- Funkce ---

// Asynchronní funkce pro renderování
async function renderPreview(mermaidCode) {
    clearError();
    if (!mermaidCode.trim()) {
        previewArea.innerHTML = ''; // Vyčistit, pokud je vstup prázdný
        currentSvgContent = '';
        return;
    }

    previewArea.innerHTML = 'Generuji náhled...'; // Indikátor načítání
    currentSvgContent = ''; // Resetovat předchozí SVG

    try {
        // Unikátní ID pro každý render, aby se předešlo konfliktům
        const renderId = `mermaid-render-${Date.now()}`;
        // Použijeme importovaný mermaid objekt
        const { svg } = await mermaid.render(renderId, mermaidCode);
        currentSvgContent = svg;
        previewArea.innerHTML = currentSvgContent;

    } catch (error) {
        console.error("Chyba při renderování Mermaid:", error);
        let errorMessage = 'Neznámá chyba při renderování.';
         if (error instanceof Error) {
            errorMessage = `Chyba při renderování: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `Chyba při renderování: ${error}`;
        }
        showError(errorMessage);
        previewArea.innerHTML = ''; // Vyčistit náhled při chybě
    }
}

// Asynchronní funkce pro generování PNG
async function generateAndDownloadPng(svgContent) {
    clearError();
    const canvas = pngCanvas; // Použijeme náš skrytý canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        showError('Nepodařilo se získat kontext canvasu.');
        return;
    }

    try {
        // Oprava SVG pro Canvg: nahradíme <br> za <br/>
        const validSvgContent = svgContent.replace(/<br>/g, '<br/>');

        // Použijeme importovaný Canvg s opraveným SVG
        const v = await Canvg.fromString(ctx, validSvgContent);

        // Nastavení rozměrů canvasu podle SVG (důležité pro správný export)
        // Přidáme malý okraj pro jistotu
        const margin = 10;
        canvas.width = v.width + margin * 2;
        canvas.height = v.height + margin * 2;

        // Vyplníme pozadí bílou barvou (volitelné, jinak bude průhledné)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Posuneme kreslení o okraj
        ctx.translate(margin, margin);

        // Vykreslení
        await v.render();

        // Získání dat jako PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png');

        // Odeslání dat do extense
        vscode.postMessage({
            command: 'downloadPng',
            data: pngDataUrl
        });

    } catch (error) {
        console.error("Chyba při generování PNG:", error);
         let errorMessage = 'Neznámá chyba při generování PNG.';
         if (error instanceof Error) {
            errorMessage = `Chyba při generování PNG: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `Chyba při generování PNG: ${error}`;
        }
        showError(errorMessage);
    } finally {
         // Vyčištění canvasu a reset transformace
         ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformace
         ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function showError(message) {
    errorArea.textContent = message;
}

function clearError() {
    errorArea.textContent = '';
}

// Zde můžeme později přidat listener pro zprávy z extense (pokud bude potřeba)
// window.addEventListener('message', event => {
//     const message = event.data; // Data poslaná z extense
//     switch (message.command) {
//         // ... zpracování příkazů ...
//     }
// });

// Listener pro zprávy z extense
window.addEventListener('message', event => {
    const message = event.data; // Data poslaná z extense
    switch (message.command) {
        case 'restoreInput':
            mermaidInput.value = message.data;
            // Volitelně můžeme hned vyrenderovat obnovený vstup
            renderPreview(message.data);
            return;
    }
});

// --- Inicializace ---
function initializeMermaid() {
    try {
        // Zjistíme, zda je aktuální téma tmavé nebo světlé
        const bodyStyle = window.getComputedStyle(document.body);
        const backgroundColor = bodyStyle.backgroundColor;
        // Jednoduchá heuristika pro detekci tmavého tématu (může vyžadovat ladění)
        // Předpokládáme, že tmavá témata mají nízkou hodnotu světlosti v RGB
        const rgb = backgroundColor.match(/\d+/g);
        let theme = 'default'; // Výchozí světlé téma
        if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            if (brightness < 128) { // Prahová hodnota pro tmavé téma
                theme = 'dark';
            }
        }

        // Použijeme importovaný mermaid objekt
        mermaid.initialize({
            startOnLoad: false, // Nebudeme automaticky renderovat při načtení
            theme: theme,
            // Můžeme přidat další konfigurace, např. bezpečnostní úroveň
            securityLevel: 'strict', // 'strict', 'loose', 'antiscript', 'sandbox'
            // Konfigurace specifická pro SVG
            flowchart: {
                 htmlLabels: true // Povolit HTML labely (pokud je potřeba)
            }
        });
        console.log(`Mermaid initialized with theme: ${theme}`);

        // Volitelně můžeme zkusit vyrenderovat obsah textarea hned po inicializaci
        if (mermaidInput.value) {
            renderPreview(mermaidInput.value);
        }

    } catch (error) {
         console.error("Chyba při inicializaci Mermaid:", error);
         showError(`Chyba při inicializaci Mermaid: ${error.message || error}`);
    }
}

// Zavoláme inicializaci po načtení DOMu
document.addEventListener('DOMContentLoaded', initializeMermaid);


console.log("Mermaid Previewer webview script loaded.");
