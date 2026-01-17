'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { DocumentOpenMethodToggle } from '@/components/settings/DocumentOpenMethodToggle';
import { SignatureEditor } from '@/components/settings/SignatureEditor';
import { PersonalEmailList } from '@/components/settings/PersonalEmailList';
import { CourtManager } from '@/components/settings/CourtManager';
import { TeamAccessManager } from '@/components/settings/TeamAccessManager';
import { BillingRates } from '@/components/settings/BillingRates';

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === 'ADMIN';
  const defaultTab = searchParams.get('tab') === 'firm' && isAdmin ? 'firm' : 'personal';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-linear-text-primary">Setări</h1>
        <p className="text-base text-linear-text-muted mt-1">
          Configurează preferințele personale și setările firmei
        </p>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <TabsList variant="pills">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          {isAdmin && <TabsTrigger value="firm">Setări Firmă</TabsTrigger>}
        </TabsList>

        {/* Personal Settings Tab */}
        <TabsContent value="personal" className="space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle>Aspect</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-linear-text-primary">Temă</p>
                  <p className="text-sm text-linear-text-muted mt-0.5">
                    Alege între modul luminos și cel întunecat
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          {/* Document Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Documente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-linear-text-primary">Deschidere documente Word</p>
                  <p className="text-sm text-linear-text-muted mt-0.5">
                    Alege unde să se deschidă documentele Word
                  </p>
                </div>
                <DocumentOpenMethodToggle />
              </div>
            </CardContent>
          </Card>

          {/* Email Signature */}
          <Card>
            <CardHeader>
              <CardTitle>Semnătură Email</CardTitle>
            </CardHeader>
            <CardContent>
              <SignatureEditor />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Firm Settings Tab - Admin only */}
        {isAdmin && (
          <TabsContent value="firm" className="space-y-6">
            {/* Team Access */}
            <Card>
              <CardHeader>
                <CardTitle>Acces Echipă</CardTitle>
              </CardHeader>
              <CardContent>
                <TeamAccessManager />
              </CardContent>
            </Card>

            {/* Personal Email Addresses */}
            <Card>
              <CardHeader>
                <CardTitle>Adrese Email Personale</CardTitle>
              </CardHeader>
              <CardContent>
                <PersonalEmailList />
              </CardContent>
            </Card>

            {/* Courts */}
            <Card>
              <CardHeader>
                <CardTitle>Instanțe</CardTitle>
              </CardHeader>
              <CardContent>
                <CourtManager />
              </CardContent>
            </Card>

            {/* Billing Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Tarife Implicite de Facturare</CardTitle>
              </CardHeader>
              <CardContent>
                <BillingRates />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
