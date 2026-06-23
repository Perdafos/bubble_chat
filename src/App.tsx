import React from 'react';
import { Overlay } from './components/Overlay';
import { Settings } from './components/Settings';

const App: React.FC = () => {
  const path = window.location.pathname;

  // Render Settings dashboard if path matches, otherwise default to the Overlay
  if (path === '/settings' || path === '/settings.html' || path === '/settings/') {
    return <Settings />;
  }

  return <Overlay />;
};

export default App;
