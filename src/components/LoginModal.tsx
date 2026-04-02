import { Loader2, Lock, Users } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export default function LoginModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
}) {
	const [characterName, setCharacterName] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		const formattedEmail = `${characterName.toLowerCase().trim()}@charel.dnd`;

		const { error } = await supabase.auth.signInWithPassword({
			email: formattedEmail,
			password: password,
		});

		if (error) {
			setError("Access Denied. Invalid credentials.");
			setLoading(false);
		} else {
			// Success! Close the modal. The auth listener in App.tsx will handle the rest.
			onOpenChange(false);
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#141414] border-white/10 text-white sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex flex-col items-center gap-2 pt-4">
						<div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
							<Users className="w-6 h-6 opacity-80" />
						</div>
						<span className="text-xl font-bold tracking-tighter uppercase italic serif">
							Server Authentication
						</span>
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleLogin} className="space-y-4 mt-4">
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50 ml-1">
							Character Alias
						</label>
						<input
							type="text"
							required
							placeholder="e.g. Bogdan"
							value={characterName}
							onChange={(e) => setCharacterName(e.target.value)}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30 transition-colors"
						/>
					</div>

					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50 ml-1">
							Passcode
						</label>
						<div className="relative">
							<Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
							<input
								type="password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full bg-white/5 border border-white/10 p-3 pl-10 rounded-lg focus:outline-none focus:border-white/30 transition-colors"
							/>
						</div>
					</div>

					{error && (
						<div className="text-red-400 text-[10px] font-mono uppercase tracking-widest text-center bg-red-400/10 p-2 rounded border border-red-400/20">
							{error}
						</div>
					)}

					<Button
						type="submit"
						disabled={loading}
						className="w-full p-4 mt-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						{loading ? (
							<Loader2 className="w-4 h-4 animate-spin mx-auto" />
						) : (
							"Connect to Server"
						)}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
