import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';

// Import contract ABI - you'll need to copy this from your compiled contract
import ShadowAuthABI from '../contracts/ShadowAuth.json';

export const useContract = (contractAddress: string) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [provider, setProvider] = useState<any>(null);

  useEffect(() => {
    if (contractAddress && typeof window.ethereum !== 'undefined') {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);

        const getSigner = async () => {
          const signer = await web3Provider.getSigner();
          const contractInstance = new ethers.Contract(
            contractAddress,
            ShadowAuthABI.abi,
            signer
          );
          setContract(contractInstance);
        };

        getSigner().catch(console.error);
      } catch (error) {
        console.error('Error setting up contract:', error);
      }
    }
  }, [contractAddress]);

  return { contract, provider };
};