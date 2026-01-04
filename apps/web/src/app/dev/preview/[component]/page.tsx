'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Import all UI components
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Separator } from '@/components/ui/Separator';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { Toast, ToastProvider, ToastViewport } from '@/components/ui/Toast';

// Component previews with meaningful content
const componentPreviews: Record<string, React.ReactNode> = {
  Button: (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex gap-2">
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  ),

  Card: (
    <div className="flex flex-col gap-4 w-[400px]">
      <Card>
        <CardHeader>
          <CardTitle>Default Card</CardTitle>
          <CardDescription>This is a card with default styling</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-linear-text-secondary">Card content goes here.</p>
        </CardContent>
        <CardFooter>
          <Button size="sm">Action</Button>
        </CardFooter>
      </Card>
      <Card variant="interactive">
        <CardHeader>
          <CardTitle>Interactive Card</CardTitle>
          <CardDescription>This card is clickable</CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),

  Input: (
    <div className="flex flex-col gap-4 w-[300px]">
      <Input placeholder="Default input" />
      <Input placeholder="With label" />
      <Input type="password" placeholder="Password" />
      <Input disabled placeholder="Disabled" />
    </div>
  ),

  Badge: (
    <div className="flex gap-2 flex-wrap">
      <Badge>Default</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
    </div>
  ),

  Avatar: (
    <div className="flex gap-4 items-center">
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    </div>
  ),

  Dialog: (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a dialog description. It provides context about the dialog content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-linear-text-secondary">Dialog body content goes here.</p>
        </div>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),

  DropdownMenu: (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button>Open Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),

  Tooltip: (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button>Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>This is a tooltip</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),

  Select: (
    <div className="w-[200px]">
      <Select defaultValue="option1">
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
          <SelectItem value="option3">Option 3</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),

  ScrollArea: (
    <ScrollArea className="h-[200px] w-[300px] rounded-md border border-linear-border-subtle p-4">
      <div className="space-y-4">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="text-sm text-linear-text-secondary">
            Scroll item {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),

  Tabs: (
    <Tabs defaultValue="tab1" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="p-4">
        <p className="text-linear-text-secondary">Content for Tab 1</p>
      </TabsContent>
      <TabsContent value="tab2" className="p-4">
        <p className="text-linear-text-secondary">Content for Tab 2</p>
      </TabsContent>
      <TabsContent value="tab3" className="p-4">
        <p className="text-linear-text-secondary">Content for Tab 3</p>
      </TabsContent>
    </Tabs>
  ),

  Separator: (
    <div className="w-[300px] space-y-4">
      <p className="text-linear-text-primary">Content above</p>
      <Separator />
      <p className="text-linear-text-secondary">Content below</p>
      <div className="flex items-center gap-4">
        <span className="text-linear-text-primary">Left</span>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-linear-text-primary">Right</span>
      </div>
    </div>
  ),

  Popover: (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button>Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-linear-text-primary">Popover Title</h4>
          <p className="text-sm text-linear-text-secondary">
            This is the popover content. It can contain any elements.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),

  Toast: (
    <ToastProvider>
      <div className="relative h-[200px] w-[400px]">
        <Toast open={true} className="relative">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-linear-text-primary">Toast Title</span>
            <span className="text-sm text-linear-text-secondary">
              This is a toast notification message.
            </span>
          </div>
        </Toast>
      </div>
    </ToastProvider>
  ),
};

function ComponentPreviewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const componentName = params.component as string;

  const preview = componentPreviews[componentName];

  if (!preview) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-linear-error text-lg">
            Component &quot;{componentName}&quot; not found
          </p>
          <div className="text-linear-text-secondary">
            <p className="mb-2">Available components:</p>
            <ul className="text-sm space-y-1">
              {Object.keys(componentPreviews).map((name) => (
                <li key={name}>
                  <a href={`/dev/preview/${name}`} className="text-linear-accent hover:underline">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-bg-primary p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-linear-text-primary mb-2">{componentName}</h1>
        <p className="text-sm text-linear-text-secondary">
          Component preview for visual inspection
        </p>
      </div>
      <div className="p-8 rounded-lg border border-linear-border-subtle bg-linear-bg-elevated">
        {preview}
      </div>
    </div>
  );
}

export default function ComponentPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-linear-bg-primary flex items-center justify-center">
          <p className="text-linear-text-secondary">Loading...</p>
        </div>
      }
    >
      <ComponentPreviewContent />
    </Suspense>
  );
}
