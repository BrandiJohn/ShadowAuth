import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/bundle'

let fhevmInstance: any = null

export const initFhevm = async () => {
  if (fhevmInstance) return fhevmInstance
  
  try {
    // Initialize the SDK first
    await initSDK()
    
    // Create instance with network configuration
    const config = { 
      ...SepoliaConfig
    }
    
    fhevmInstance = await createInstance(config)
    return fhevmInstance
  } catch (error) {
    console.error('Failed to initialize FHEVM:', error)
    throw error
  }
}

export const getFhevmInstance = () => {
  if (!fhevmInstance) {
    throw new Error('FHEVM not initialized. Call initFhevm() first.')
  }
  return fhevmInstance
}