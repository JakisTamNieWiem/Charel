import { Loader2, Lock, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

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
			<DialogContent className="sm:max-w-">
				<DialogHeader>
					<DialogTitle className="flex flex-col items-center gap-4 pt-4">
						<div className="size-24 bg-foreground/5 rounded-full flex items-center justify-center border border-foreground/10">
							<Users className="size-12 opacity-80" />
						</div>
						<span className="text-xl font-bold tracking-tighter uppercase italic serif">
							Server Authentication
						</span>
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleLogin} className="space-y-4 mt-4">
					<Field>
						<FieldLabel
							htmlFor="alias"
							className="text-[10px] uppercase font-mono tracking-widest opacity-50 ml-1"
						>
							Character Alias
						</FieldLabel>
						<Input
							id="alias"
							type="text"
							required
							placeholder="e.g. Bogdan"
							value={characterName}
							onChange={(e) =>
								setCharacterName(e.target.value.toLocaleLowerCase())
							}
							className="w-full"
						/>
					</Field>

					<Field>
						<FieldLabel
							htmlFor="passcode"
							className="text-[10px] uppercase font-mono tracking-widest opacity-50 ml-1"
						>
							Passcode
						</FieldLabel>
						<div className="relative">
							<Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
							<Input
								id="passcode"
								type="password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full pl-10"
							/>
						</div>
					</Field>

					{error && (
						<div className="text-red-400 text-[10px] font-mono uppercase tracking-widest text-center bg-red-400/10 p-2 rounded border border-red-400/20">
							{error}
						</div>
					)}

					<Button
						type="submit"
						disabled={loading}
						className="w-full p-4 mt-2 transition-colors uppercase text-xs font-bold tracking-widest"
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
