import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import App from './App';
import './index.css';

async function configureAmplify() {
  try {
    const outputs = await import('../amplify_outputs.json');
    Amplify.configure(outputs.default ?? outputs);
  } catch {
    // No Amplify outputs yet — app runs on localStorage until sandbox/deploy.
  }
}

void configureAmplify().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
