import * as vscode from 'vscode';

export class MermaidViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'mermaidPreviewerView'; // Musí odpovídat ID v package.json

    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext; // Přidáno pro přístup ke stavu
    private _subscriptions: vscode.Disposable[]; // Přidáno pro ukládání disposables

    constructor(
        context: vscode.ExtensionContext, // Přijímáme celý context
        private readonly _extensionUri: vscode.Uri
        // subscriptions už nepotřebujeme explicitně, vezmeme je z context.subscriptions
    ) {
        this._context = context;
        this._context = context;
        this._subscriptions = context.subscriptions; // Uložíme subscriptions z contextu
     }

    private static readonly stateKey = 'mermaidPreviewer.lastInput'; // Klíč pro uložení stavu

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext, // Přejmenováno, abychom se vyhnuli konfliktu s this._context
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Povolit skripty ve webview
            enableScripts: true,

            // Omezit webview na načítání zdrojů pouze z naší extenze
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Zde později přidáme listener pro zprávy z webview
        // webviewView.webview.onDidReceiveMessage(data => {
        //     // ... zpracování zpráv ...
        // Listener pro zprávy z webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'downloadSvg':
                        this.handleDownload(message.data, 'svg');
                        return;
                    case 'downloadPng':
                        this.handleDownload(message.data, 'png');
                        return;
                    case 'saveInput': // Nový příkaz pro uložení vstupu
                        this._context.workspaceState.update(MermaidViewProvider.stateKey, message.data);
                        return;
                }
            },
            undefined,
            this._subscriptions
        );

        // Pošleme uložený stav do webview při jeho vytvoření
        const lastInput = this._context.workspaceState.get<string>(MermaidViewProvider.stateKey);
        if (lastInput) {
            webviewView.webview.postMessage({ command: 'restoreInput', data: lastInput });
        }
    }

    // Metoda pro zpracování požadavku na stažení
    private async handleDownload(data: string, format: 'svg' | 'png') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Pro uložení souboru otevřete složku nebo pracovní prostor.');
            return;
        }

        // Použijeme první otevřenou složku jako cíl
        const folderUri = workspaceFolders[0].uri;
        const fileName = `mermaid-output.${format}`;
        const fileUri = vscode.Uri.joinPath(folderUri, fileName);

        try {
            let contentBuffer: Uint8Array;
            if (format === 'svg') {
                // SVG je text, převedeme ho na Uint8Array
                contentBuffer = new TextEncoder().encode(data);
            } else {
                // PNG je base64 data URL, musíme extrahovat data a dekódovat
                const base64Data = data.split(',')[1]; // Odstraníme 'data:image/png;base64,'
                if (!base64Data) {
                    throw new Error('Neplatný formát PNG dat.');
                }
                contentBuffer = Buffer.from(base64Data, 'base64');
            }

            await vscode.workspace.fs.writeFile(fileUri, contentBuffer);
            vscode.window.showInformationMessage(`Soubor ${fileName} byl úspěšně uložen.`);

        } catch (error) {
            console.error('Chyba při ukládání souboru:', error);
            let errorMessage = 'Neznámá chyba při ukládání souboru.';
            if (error instanceof Error) {
                errorMessage = `Nepodařilo se uložit soubor: ${error.message}`;
            } else if (typeof error === 'string') {
                 errorMessage = `Nepodařilo se uložit soubor: ${error}`;
            }
            vscode.window.showErrorMessage(errorMessage);
        }
    }


    // Zde později přidáme metodu pro odeslání zprávy do webview
    // public sendDataToWebview(data: any) {
    //     if (this._view) {
    //         this._view.webview.postMessage(data);
    //     }
    // }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Získání URI pro bundlovaný skript webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'webview.js'));
        // URI pro jednotlivé knihovny už nepotřebujeme

        // Použití nonce pro povolení pouze specifických inline skriptů/stylů v CSP
        const nonce = getNonce();

        // Základní HTML struktura načtená z index.html (zatím inline pro jednoduchost,
        // později můžeme načítat ze souboru, ale pro vkládání URI je to takto jednodušší)
        // POZNÁMKA: Obsah <style> a <body> je zkopírován z webview-ui/index.html
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!-- Content Security Policy -->
                <!-- Zjednodušené pravidlo pro script-src -->
				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					style-src ${webview.cspSource} 'unsafe-inline';
					script-src 'nonce-${nonce}' ${webview.cspSource};
					img-src ${webview.cspSource} data:;
					font-src ${webview.cspSource};
				">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Mermaid Preview</title>
				<style>
                    /* Základní styly pro lepší čitelnost, později přesuneme do CSS souboru */
                    body {
                        padding: 10px;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        font-family: var(--vscode-font-family);
                    }
                    textarea {
                        width: 95%;
                        height: 150px;
                        margin-bottom: 10px;
                        display: block;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                    }
                    button {
                        margin-right: 5px;
                        margin-bottom: 10px;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border);
                        padding: 4px 8px;
                        cursor: pointer;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    #preview-area {
                        border: 1px solid var(--vscode-editorWidget-border);
                        padding: 10px;
                        min-height: 100px;
                        background-color: var(--vscode-textCodeBlock-background); /* Lehce odlišené pozadí */
                    }
                    #preview-area svg { /* Zajistíme, aby SVG mělo rozumnou šířku */
                        max-width: 100%;
                        height: auto;
                    }
                    #error-area {
                        color: var(--vscode-errorForeground);
                        margin-top: 10px;
                        white-space: pre-wrap; /* Zachovat formátování chybové zprávy */
                    }
				</style>
			</head>
			<body>
				<textarea id="mermaid-input" placeholder="Zadejte Mermaid kód zde..."></textarea>
				<button id="download-svg-button">Download SVG</button>
				<button id="download-png-button">Download PNG</button>

				<div id="preview-area">
					<!-- Zde se zobrazí náhled -->
				</div>
				<div id="error-area">
					<!-- Zde se zobrazí případné chyby -->
				</div>

				<!-- Skrytý canvas pro generování PNG -->
				<canvas id="png-canvas" style="display: none;"></canvas>

                <!-- Vložení jediného bundlovaného skriptu jako modulu -->
				<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}

// Funkce pro generování náhodného řetězce (nonce)
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
