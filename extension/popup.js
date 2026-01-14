const STORAGE_KEYS = {
  TEXA_ORIGIN: 'texa_origin',
  TEXA_TOKEN: 'texa_token',
  TEXA_USER: 'texa_user',
  LAST_SYNC: 'last_sync'
};

class TEXAToolsManager {
  constructor() {
    this.origin = '';
    this.idToken = '';
    this.user = null;
    this.tools = [];
    this.init();
  }

  async init() {
    await this.loadStoredData();
    await this.checkConnection();
    await this.loadTools();
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TEXA_ORIGIN,
        STORAGE_KEYS.TEXA_TOKEN,
        STORAGE_KEYS.TEXA_USER
      ]);
      
      this.origin = result[STORAGE_KEYS.TEXA_ORIGIN] || '';
      this.idToken = result[STORAGE_KEYS.TEXA_TOKEN] || '';
      this.user = result[STORAGE_KEYS.TEXA_USER] || null;
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }

  async checkConnection() {
    const statusEl = document.getElementById('status');
    
    if (!this.origin || !this.idToken) {
      statusEl.textContent = 'Belum terhubung ke dashboard TEXA';
      statusEl.className = 'status disconnected';
      return false;
    }

    try {
      // Use catalog endpoint to check connection as it is accessible to all members
      const response = await fetch(`${this.origin}/api/catalog`, {
        headers: {
          'Authorization': `Bearer ${this.idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        statusEl.textContent = `Terhubung sebagai ${this.user?.email || 'Member'}`;
        statusEl.className = 'status connected';
        return true;
      } else {
        statusEl.textContent = 'Koneksi gagal - silakan login ulang';
        statusEl.className = 'status disconnected';
        return false;
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      statusEl.textContent = 'Koneksi error - periksa koneksi internet';
      statusEl.className = 'status disconnected';
      return false;
    }
  }

  async loadTools() {
    const contentEl = document.getElementById('content');
    
    if (!this.origin || !this.idToken) {
      contentEl.innerHTML = `
        <div class="error">
          Silakan login ke dashboard TEXA terlebih dahulu untuk melihat tools.
        </div>
      `;
      return;
    }

    try {
      const response = await fetch(`${this.origin}/api/catalog`, {
        headers: {
          'Authorization': `Bearer ${this.idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load tools');
      }

      const data = await response.json();
      this.tools = data && data.tools ? data.tools : [];
      
      this.renderTools();
    } catch (error) {
      console.error('Error loading tools:', error);
      contentEl.innerHTML = `
        <div class="error">
          Gagal memuat tools. Silakan refresh atau cek koneksi.
        </div>
      `;
    }
  }

  renderTools() {
    const contentEl = document.getElementById('content');
    
    if (!this.tools.length) {
      contentEl.innerHTML = `
        <div class="error">
          Tidak ada tools yang tersedia atau belum berlangganan.
        </div>
      `;
      return;
    }

    const toolsHtml = this.tools.map(tool => `
      <div class="tool-item" data-tool-id="${tool.id}">
        <div class="tool-name">${this.escapeHtml(tool.name || 'Unnamed Tool')}</div>
        <div class="tool-url">${this.escapeHtml(tool.targetUrl || 'No URL')}</div>
        <button class="btn-primary" onclick="texaManager.openTool('${tool.id}')">
          Open Tool
        </button>
      </div>
    `).join('');

    contentEl.innerHTML = `<div class="tools-list">${toolsHtml}</div>`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async openTool(toolId) {
    try {
      const message = {
        type: 'TEXA_OPEN_TOOL',
        origin: this.origin,
        toolId: toolId,
        idToken: this.idToken
      };

      const response = await chrome.runtime.sendMessage(message);
      
      if (response && response.ok) {
        window.close();
      } else {
        alert('Gagal membuka tool. Silakan coba lagi.');
      }
    } catch (error) {
      console.error('Error opening tool:', error);
      alert('Error membuka tool. Periksa console untuk detail.');
    }
  }
}

const texaManager = new TEXAToolsManager();

window.texaManager = texaManager;