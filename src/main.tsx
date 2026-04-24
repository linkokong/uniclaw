import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import type { BaseWalletAdapter } from '@solana/wallet-adapter-base'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { AnchorProvider } from '@coral-xyz/anchor'
import App from './App'
import './index.css'
import '@solana/wallet-adapter-react-ui/styles.css'

const queryClient = new QueryClient()

// Solana RPC endpoint (devnet)
const endpoint = 'https://api.devnet.solana.com'

// ─── Patch AnchorProvider.local() to work in browser ────────────────────────
const connection = new Connection(endpoint, 'confirmed')
AnchorProvider.local = () => new AnchorProvider(
  connection,
  {
    publicKey: PublicKey.default,
    signTransaction: async <T extends Transaction>(tx: T) => tx,
    signAllTransactions: async <T extends Transaction>(txs: T[]) => txs,
  } as never,
  { commitment: 'confirmed' }
)

// Only include non-Standard adapters — Phantom registers itself as a
// Standard Wallet automatically, so adding PhantomWalletAdapter causes
// the "Phantom was registered as a Standard Wallet" console warning.
let _wallets: BaseWalletAdapter[] | null = null
function getWallets(): BaseWalletAdapter[] {
  if (_wallets) return _wallets
  const adapters: BaseWalletAdapter[] = []
  for (const Adapter of [SolflareWalletAdapter]) {
    try {
      adapters.push(new Adapter())
    } catch {
      // Adapter not available in this browser
    }
  }
  _wallets = adapters
  return adapters
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={getWallets()} autoConnect onError={(error) => {
        if (error.name !== 'WalletNotReadyError') {
          console.error('[Wallet]', error)
        }
      }}>
        <WalletModalProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </QueryClientProvider>,
)
