"use client";

import * as React from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineLoader } from "@/components/loaders";
import { sendEmail } from "@/lib/emailjs";
import { cn } from "@/lib/utils";

type WebsiteStruggleFormDialogProps = {
    trigger?: React.ReactNode;
    triggerClassName?: string;
};

export function WebsiteStruggleFormDialog({ trigger, triggerClassName }: WebsiteStruggleFormDialogProps = {}) {
    const [open, setOpen] = React.useState(false);
    const [fullName, setFullName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [whatsapp, setWhatsapp] = React.useState("");
    const [attempts, setAttempts] = React.useState("");
    const [examDate, setExamDate] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const reset = React.useCallback(() => {
        setFullName("");
        setEmail("");
        setWhatsapp("");
        setAttempts("");
        setExamDate("");
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const name = fullName.trim();
        const emailAddress = email.trim();
        const wa = whatsapp.trim();
        const att = attempts.trim();
        if (!wa || !att) {
            return;
        }
        if (!emailAddress) {
            setError("Email address is required so we can follow up with you.");
            return;
        }

        setSubmitting(true);
        setError(null);

        const orderDetails = [
            name ? `Full Name: ${name}` : null,
            `Email: ${emailAddress}`,
            `WhatsApp: ${wa}`,
            `OET Attempts: ${att}`,
            examDate.trim() ? `Exam Date: ${examDate.trim()}` : null
        ]
            .filter(Boolean)
            .join("\n");

        const orderId = `OET-${Date.now()}`;
        const result = await sendEmail(name || emailAddress, emailAddress, orderDetails, orderId);

        setSubmitting(false);

        if (result.success) {
            toast.success("Thanks! Check your email — we will follow up with next steps.");
            setOpen(false);
            reset();
            return;
        }

        setError(result.error || "Could not send your request. Please try again.");
    };

    return (
        <Dialog
            open={open}
            onOpenChange={next => {
                setOpen(next);
                if (!next) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                {trigger ?? (
                    <button
                        type="button"
                        className={cn(
                            "inline-block rounded-full bg-blue-600 px-7 py-3 font-semibold text-white transition hover:bg-blue-700 hover:text-white",
                            triggerClassName
                        )}
                    >
                        End My OET Struggle Now
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Get started</DialogTitle>
                    <DialogDescription>
                        Share your details and we will follow up with next steps for your OET journey.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="struggle-full-name">Full Name</Label>
                        <Input
                            id="struggle-full-name"
                            name="fullName"
                            type="text"
                            autoComplete="name"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Your full name"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="struggle-email">Email Address</Label>
                        <Input
                            id="struggle-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="struggle-whatsapp">
                            WhatsApp Number <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="struggle-whatsapp"
                            name="whatsapp"
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            required
                            value={whatsapp}
                            onChange={e => setWhatsapp(e.target.value)}
                            placeholder="+92 300 1234567"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="struggle-attempts">
                            Number of OET Attempts <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="struggle-attempts"
                            name="attempts"
                            type="number"
                            min={0}
                            step={1}
                            required
                            value={attempts}
                            onChange={e => setAttempts(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="struggle-exam-date">Exam Date</Label>
                        <Input
                            id="struggle-exam-date"
                            name="examDate"
                            type="date"
                            value={examDate}
                            onChange={e => setExamDate(e.target.value)}
                        />
                    </div>
                    {error ? (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    ) : null}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={submitting}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                            {submitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <InlineLoader label="Sending" size="sm" />
                                </span>
                            ) : (
                                "Submit"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
