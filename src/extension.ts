import * as vscode from 'vscode';
import { MermaidViewProvider } from './MermaidViewProvider'; // Importujeme náš provider

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "mermaid-previewer" is now active!');

	// Vytvoříme instanci našeho providera a předáme mu celý context a extensionUri
	const provider = new MermaidViewProvider(context, context.extensionUri);

	// Zaregistrujeme providera pro náš view
	// View ID musí odpovídat ID definovanému v package.json
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MermaidViewProvider.viewType, provider)
	);

	// Původní 'helloWorld' command už nepotřebujeme
	// const disposable = vscode.commands.registerCommand('mermaid-previewer.helloWorld', () => {
	// 	vscode.window.showInformationMessage('Hello World from Mermaid Previewer!');
	// });
	// context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
