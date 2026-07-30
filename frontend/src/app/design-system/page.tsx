import Link from "next/link";
import { Flex, Grid, Heading, Section, Text } from "@radix-ui/themes";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DesignSystemOtpDemo } from "./otp-demo";

export const metadata = {
  title: "Design system · OET LMS",
  description: "Radix Themes-first component system for OET LMS",
};

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 lg:px-8">
      <header className="surface-panel space-y-3 px-6 py-6">
        <Badge variant="outline">Radix Themes playground</Badge>
        <Heading size="8">OET LMS design system</Heading>
        <Text size="3" className="max-w-3xl text-muted-foreground">
          This page demonstrates the redesigned component layer and visual language used across public, auth, portal,
          and admin routes.
        </Text>
        <Button asChild variant="ghost">
          <Link href="/">Back to app</Link>
        </Button>
      </header>

      <Section className="space-y-4">
        <Heading size="5">Buttons and statuses</Heading>
        <Flex wrap="wrap" gap="2">
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
        </Flex>
        <Flex wrap="wrap" gap="2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
        </Flex>
      </Section>

      <Section className="space-y-4">
        <Heading size="5">Form primitives</Heading>
        <Grid columns={{ initial: "1", lg: "2" }} gap="4">
          <Card>
            <CardHeader>
              <CardTitle>Input fields</CardTitle>
              <CardDescription>Token-based labels, inputs, and validation-ready spacing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="design-email">Email</Label>
                <Input id="design-email" type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="design-notes">Notes</Label>
                <Textarea id="design-notes" placeholder="Candidate notes..." rows={4} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="design-policy" />
                <Label htmlFor="design-policy" className="font-normal">
                  I accept the platform policy.
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OTP and mode controls</CardTitle>
              <CardDescription>Authentication interactions used in login/register workflows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DesignSystemOtpDemo />
              <div className="space-y-2">
                <Label>Attempt mode</Label>
                <RadioGroup defaultValue="practice" className="gap-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="practice" id="practice" />
                    <Label htmlFor="practice" className="font-normal">
                      Practice
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="graded" id="graded" />
                    <Label htmlFor="graded" className="font-normal">
                      Graded attempt
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Section>

      <Section className="space-y-4">
        <Heading size="5">Feedback and navigation</Heading>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>System note</AlertTitle>
          <AlertDescription>
            Alerts, progress indicators, and tabs now share one visual rhythm across all product areas.
          </AlertDescription>
        </Alert>
        <div className="max-w-md space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>72%</span>
          </div>
          <Progress value={72} />
        </div>
        <Tabs defaultValue="outline" className="max-w-2xl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="grades">Grades</TabsTrigger>
            <TabsTrigger value="discuss">Discussion</TabsTrigger>
          </TabsList>
          <TabsContent value="outline" className="rounded-xl border p-4 text-sm text-muted-foreground">
            Weekly topics and reading objectives.
          </TabsContent>
          <TabsContent value="grades" className="rounded-xl border p-4 text-sm text-muted-foreground">
            Scoring and coach feedback.
          </TabsContent>
          <TabsContent value="discuss" className="rounded-xl border p-4 text-sm text-muted-foreground">
            Candidate and tutor discussion threads.
          </TabsContent>
        </Tabs>
      </Section>

      <Section className="space-y-4">
        <Heading size="5">Data table style</Heading>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">A. Student</TableCell>
              <TableCell>Clinical communication</TableCell>
              <TableCell className="text-right">88</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">B. Learner</TableCell>
              <TableCell>Reading</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>
    </main>
  );
}
