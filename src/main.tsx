import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import App from './App'
import './index.css'
import '@solana/wallet-adapter-react-ui/styles.css'

const queryClient = new QueryClient()

// Solana RPC endpoint
const endpoint = 'https://api.devnet.solana.com'
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode removed: PhantomWalletAdapter causes hooks order mismatch with double render
  <QueryClientProvider client={queryClient}>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </QueryClientProvider>,
)
