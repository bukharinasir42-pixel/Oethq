"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Layers, SlidersHorizontal } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function Section({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TestComponentsShowcase() {
  const [progress] = React.useState(74);
  const [alignment, setAlignment] = React.useState("left");
  const [attemptMode, setAttemptMode] = React.useState("practice");

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
        <header className="surface-panel space-y-3 px-6 py-6">
          <Badge variant="outline">Component QA page</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Radix redesign component test page</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            This is the redesigned interaction surface for quick visual verification across commonly used UI primitives.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/design-system">Open Design System</Link>
            </Button>
          </div>
        </header>

        <Section
          title="Buttons, badges, and toggles"
          description="Primary action hierarchy and compact state indicators."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button">Primary</Button>
              <Button type="button" variant="secondary">
                Secondary
              </Button>
              <Button type="button" variant="outline">
                Outline
              </Button>
              <Button type="button" variant="ghost">
                Ghost
              </Button>
              <Button type="button" variant="destructive">
                Destructive
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Live</Badge>
              <Badge variant="secondary">Draft</Badge>
              <Badge variant="outline">Needs review</Badge>
            </div>
            <div className="space-y-2">
              <Label>Text alignment</Label>
              <ToggleGroup type="single" value={alignment} onValueChange={(value) => value && setAlignment(value)}>
                <ToggleGroupItem value="left">Left</ToggleGroupItem>
                <ToggleGroupItem value="center">Center</ToggleGroupItem>
                <ToggleGroupItem value="right">Right</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </Section>

        <Section
          title="Form controls"
          description="Input, select, radio, and textarea patterns used by auth and admin pages."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-title">Title</Label>
                <Input id="test-title" placeholder="Enter title..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-select">Plan tier</Label>
                <Select defaultValue="foundation">
                  <SelectTrigger id="test-select">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foundation">Foundation</SelectItem>
                    <SelectItem value="accelerator">Accelerator</SelectItem>
                    <SelectItem value="mastery">Mastery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Attempt mode</Label>
                <RadioGroup value={attemptMode} onValueChange={setAttemptMode}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="mode-practice" value="practice" />
                    <Label htmlFor="mode-practice" className="font-normal">
                      Practice
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="mode-graded" value="graded" />
                    <Label htmlFor="mode-graded" className="font-normal">
                      Graded
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-notes">Notes</Label>
              <Textarea id="test-notes" rows={8} placeholder="Write candidate notes..." />
            </div>
          </div>
        </Section>

        <Section
          title="Feedback states"
          description="Inline feedback style for loading, empty, and success/error moments."
        >
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Auto-save enabled</AlertTitle>
              <AlertDescription>Candidate progress is persisted every 15 seconds during active attempts.</AlertDescription>
            </Alert>
            <div className="max-w-lg space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Readiness progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            <EmptyState
              icon={Layers}
              title="No data loaded"
              description="This placeholder shows how empty dashboards appear before first activity."
            />
          </div>
        </Section>

        <Section
          title="Navigation and overlays"
          description="Tabs, accordion, dialog, and tooltip interactions for dense workflows."
        >
          <div className="space-y-4">
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="tests">Tests</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="rounded-xl border p-4 text-sm">
                Workspace overview content.
              </TabsContent>
              <TabsContent value="tasks" className="rounded-xl border p-4 text-sm">
                Task management content.
              </TabsContent>
              <TabsContent value="tests" className="rounded-xl border p-4 text-sm">
                Test engine content.
              </TabsContent>
            </Tabs>

            <Accordion type="single" collapsible>
              <AccordionItem value="rules">
                <AccordionTrigger>Exam guardrails</AccordionTrigger>
                <AccordionContent>
                  Single-pass listening audio, section timers, and auto-submit behavior are enforced server-side.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="retakes">
                <AccordionTrigger>Retake policy</AccordionTrigger>
                <AccordionContent>
                  Every attempt is preserved, while retained results hold the latest score per test for reporting.
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-wrap items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Publish confirmation</DialogTitle>
                    <DialogDescription>Review test timers and answer keys before making this test visible.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost">
                    <SlidersHorizontal className="h-4 w-4" />
                    Hover for tip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Use this panel to tune workspace filters.</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </Section>

        <Section
          title="Data table"
          description="The redesigned table baseline used for results and admin overview data."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Retained score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Ayesha Khan</TableCell>
                <TableCell>Mastery</TableCell>
                <TableCell>Active</TableCell>
                <TableCell className="text-right">86</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Hassan Ali</TableCell>
                <TableCell>Foundation</TableCell>
                <TableCell>Trial</TableCell>
                <TableCell className="text-right">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>
      </main>
    </TooltipProvider>
  );
}
