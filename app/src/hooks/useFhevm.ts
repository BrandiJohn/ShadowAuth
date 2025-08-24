import { useState, useEffect } from 'react';
import { FhevmInstance } from '../types';

declare global {
  interface Window {
    fhevm?: any;
  }
}

export const useFhevm = () => {
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initFhevm = async () => {
      try {
        // Load FHEVM SDK from CDN if not already loaded
        if (!window.fhevm) {
          const script = document.createElement('script');
          script.src = 'https://cdn.zama.ai/relayer-sdk-js/0.1.0-9/relayer-sdk-js.umd.cjs';
          script.onload = async () => {
            await window.fhevm.initSDK();
            const config = { 
              ...window.fhevm.SepoliaConfig, 
              network: window.ethereum 
            };
            const fhevmInstance = await window.fhevm.createInstance(config);
            setInstance(fhevmInstance);
            setIsInitialized(true);
          };
          document.head.appendChild(script);
        } else {
          // Already loaded
          if (!isInitialized) {
            await window.fhevm.initSDK();
            const config = { 
              ...window.fhevm.SepoliaConfig, 
              network: window.ethereum 
            };
            const fhevmInstance = await window.fhevm.createInstance(config);
            setInstance(fhevmInstance);
            setIsInitialized(true);
          }
        }
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
      }
    };

    if (typeof window.ethereum !== 'undefined') {
      initFhevm();
    }
  }, [isInitialized]);

  return { instance, isInitialized };
};