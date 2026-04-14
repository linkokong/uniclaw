import WalletConnect from './WalletConnect'

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0a0a1a] border-b border-gray-800 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center font-bold text-white">
          CU
        </div>
        <span className="text-lg font-semibold">Claw Universe</span>
      </div>

      <div className="flex items-center gap-4">
        <WalletConnect />
      </div>
    </header>
  )
}
