// import mermaid from 'mermaid'; // Removed, loaded via CDN now
// import { Canvg } from 'canvg'; // Removed unused import

// Získání přístupu k VS Code API pro komunikaci mezi webview a extensí
// Tuto funkci lze volat pouze jednou
const vscode = acquireVsCodeApi();

// Reference na HTML elementy
const mermaidInput = document.getElementById('mermaid-input');
// const previewButton = document.getElementById('preview-button'); // Odstraněno
const downloadSvgButton = document.getElementById('download-svg-button');
// const downloadPngButton = document.getElementById('download-png-button'); // Removed
const previewArea = document.getElementById('preview-area');
const errorArea = document.getElementById('error-area'); // Keeping error area for Mermaid errors
// const pngCanvas = document.getElementById('png-canvas'); // Removed

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

// downloadPngButton.addEventListener('click', () => { // Removed listener
//     if (currentSvgContent) {
//         generateAndDownloadPng(currentSvgContent);
//     } else {
//         showError('Nejdříve vygenerujte náhled (Preview).');
//     }
// });

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

// Removed generateAndDownloadPng function

function showError(message) {
    // Ensure errorArea still exists before trying to set textContent
    if (errorArea) {
        errorArea.textContent = message;
    } else {
        console.error("Error area element not found, cannot display message:", message);
    }
}

function clearError() {
    // Ensure errorArea still exists before trying to clear it
    if (errorArea) {
        errorArea.textContent = '';
    }
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
