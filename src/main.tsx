import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
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
// Anchor SDK calls this internally as a fallback; override it to return
// a read-only provider instead of throwing "not available on browser"
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

// Lazily instantiate adapters — Phantom may not be injected at module load time
// so we defer until the WalletProvider first renders
let _wallets: BaseWalletAdapter[] | null = null
function getWallets(): BaseWalletAdapter[] {
  if (_wallets) return _wallets
  const adapters: BaseWalletAdapter[] = []
  for (const Adapter of [PhantomWalletAdapter, SolflareWalletAdapter]) {
    try {
      adapters.push(new Adapter())
    } catch {
      // Adapter not available in this browser
    }
  }
  _wallets = adapters
  console.debug('[Wallet] Available adapters:', adapters.map(a => a.name))
  return adapters
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ConnectionProvider endpoint={endpoint}>
      {/* autoConnect=false: prevents "Provider local is not available" error when no wallet extension is installed */}
      <WalletProvider wallets={getWallets()} autoConnect={false}>
        <WalletModalProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </QueryClientProvider>,
)
