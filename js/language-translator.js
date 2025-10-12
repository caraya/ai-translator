class LanguageTranslator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }
  
  async translate() {
    const originalContentEl = this.shadowRoot.querySelector('#original-content');
    if (!originalContentEl) return;

    const contentSelector = this.getAttribute('content-selector');
    if (!contentSelector) {
      originalContentEl.textContent = "Error: 'content-selector' attribute is missing.";
      return;
    }

    const elementToTranslate = document.querySelector(contentSelector);
    if (!elementToTranslate || !elementToTranslate.textContent) return;

    const originalText = elementToTranslate.textContent;
    originalContentEl.textContent = originalText; 

    const selectElement = this.shadowRoot.querySelector('#language-select');
    const targetLanguage = selectElement.value;
    const translatedContentEl = this.shadowRoot.querySelector('#translated-content');

    if ('Translator' in self && 'LanguageDetector' in self) {
      translatedContentEl.textContent = 'Checking for built-in translator...';
      try {
        const detector = await LanguageDetector.create();
        const detectionResults = await detector.detect(originalText);

        if (
          !Array.isArray(detectionResults) ||
          detectionResults.length === 0 ||
          !detectionResults[0].detectedLanguage
        ) {
          throw new Error("Language detection returned an empty or invalid result.");
        }
        
        const sourceLanguage = detectionResults[0].detectedLanguage;

        translatedContentEl.textContent = 'Requesting translator. This may trigger a download...';

        const translator = await Translator.create({
          sourceLanguage,
          targetLanguage,
          monitor(m) {
            translatedContentEl.textContent = 'Downloading translation model...';
            m.addEventListener('downloadprogress', (e) => {
              const percentage = (e.loaded / e.total) * 100;
              console.log(`Downloading model: ${percentage.toFixed(2)}%`);
              translatedContentEl.textContent = `Downloading translation model: ${percentage.toFixed(0)}%`;
            });
          },
        });

        // ---- START: STREAMING IMPLEMENTATION ----
        translatedContentEl.textContent = 'Translating (streaming)...';
        
        // 1. Get the stream from the translator.
        const stream = translator.translateStreaming(originalText);
        
        // 2. Clear the element and prepare to append chunks.
        translatedContentEl.textContent = ''; 
        
        // 3. Loop through the stream and append each chunk as it arrives.
        for await (const chunk of stream) {
          translatedContentEl.textContent += chunk;
        }
        // ---- END: STREAMING IMPLEMENTATION ----

      } catch (error) {
        const message = `An error occurred with the built-in translator: ${error.message}`;
        console.error('Built-in translation failed:', error);
        translatedContentEl.textContent = message;
      }
    } else {
      const message = "The browser's built-in Translator API was not found.";
      console.log(message);
      translatedContentEl.textContent = message;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: sans-serif;
          border: 1px solid #ccc;
          padding: 16px;
          border-radius: 8px;
          max-width: 600px;
        }
        #controls {
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        h3 {
          margin-top: 0;
          margin-bottom: 8px;
          color: #333;
        }
        p {
          margin-top: 0;
          color: #555;
        }
        #translated-content {
          font-style: italic;
          color: #333;
        }
        select {
          padding: 4px 8px;
          border-radius: 4px;
        }
        button {
          padding: 6px 12px;
          border: none;
          background-color: #007bff;
          color: white;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #0056b3;
        }
      </style>
      <div id="controls">
        <label for="language-select">Translate to:</label>
        <select id="language-select">
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ja">Japanese</option>
        </select>
        <button id="translate-btn">Translate</button>
      </div>
      <div>
        <h3>Original</h3>
        <p id="original-content">The original text will appear here once you press translate.</p>
      </div>
      <div>
        <h3>Translated</h3>
        <p id="translated-content">Select a language and press translate.</p>
      </div>
    `;
    
    this.shadowRoot.querySelector('#translate-btn').addEventListener('click', () => this.translate());
  }
}

customElements.define('language-translator', LanguageTranslator);