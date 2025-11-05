/**
 * Widget Entry Point
 * Exposes global HuronChatWidget object for embedding
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import type { WidgetConfig } from './types';

// Global widget interface
interface HuronChatWidget {
  init: (config: WidgetConfig & { containerId: string }) => void;
  destroy: () => void;
}

// Store widget instance
let widgetRoot: ReactDOM.Root | null = null;

// Create global widget object
const HuronChatWidget: HuronChatWidget = {
  /**
   * Initialize the chat widget
   * @param config - Widget configuration including containerId
   */
  init(config) {
    const container = document.getElementById(config.containerId);

    if (!container) {
      console.error(`HuronChatWidget: Container #${config.containerId} not found`);
      return;
    }

    // Clean up existing widget if any
    if (widgetRoot) {
      widgetRoot.unmount();
    }

    // Create and mount widget
    widgetRoot = ReactDOM.createRoot(container);
    widgetRoot.render(
      <React.StrictMode>
        <App config={config} />
      </React.StrictMode>
    );

    console.log('✅ Huron Chat Widget initialized');
  },

  /**
   * Destroy the widget instance
   */
  destroy() {
    if (widgetRoot) {
      widgetRoot.unmount();
      widgetRoot = null;
      console.log('Huron Chat Widget destroyed');
    }
  },
};

// Expose to window object
declare global {
  interface Window {
    HuronChatWidget: HuronChatWidget;
  }
}

window.HuronChatWidget = HuronChatWidget;

// Auto-initialize if config is provided via data attributes
document.addEventListener('DOMContentLoaded', () => {
  const autoInitScript = document.querySelector<HTMLScriptElement>(
    'script[data-huron-auto-init]'
  );

  if (autoInitScript) {
    const containerId = autoInitScript.dataset.huronContainer || 'huron-chat-widget';
    const apiUrl = autoInitScript.dataset.huronApiUrl || 'http://localhost:4000';
    const theme = (autoInitScript.dataset.huronTheme as 'light' | 'dark') || 'light';
    const position = (autoInitScript.dataset.huronPosition as 'bottom-right' | 'bottom-left') || 'bottom-right';

    HuronChatWidget.init({
      containerId,
      apiUrl,
      theme,
      position,
      autoOpen: autoInitScript.dataset.huronAutoOpen === 'true',
    });
  }
});

export default HuronChatWidget;
