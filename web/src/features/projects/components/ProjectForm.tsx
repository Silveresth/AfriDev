'use client';

import { ArrowLeft, BookOpen, FolderGit2, Save, Sparkles, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { PageContainer, PageHeader } from '@/shared/layout';
import {
  Button,
  CardSkeleton,
  Field,
  FormCard,
  FormError,
  FormFooter,
  FormSection,
  Input,
  TagInput,
  Textarea,
  TipCard,
  ToggleRow,
  useToast,
} from '@/shared/ui';

import { type ProjectInput, useProject, useSaveProject } from '../api';

const EMPTY: ProjectInput = { name: '', description: '', repo_url: '', tags: [], is_recruiting: true };

export function ProjectFormScreen({ id }: { id?: string }) {
  const existing = useProject(id);
  if (id && !existing.data) return <CardSkeleton lines={5} />;
  const initial = existing.data
    ? {
        name: existing.data.name,
        description: existing.data.description,
        repo_url: existing.data.repo_url,
        tags: existing.data.tags,
        is_recruiting: existing.data.is_recruiting,
      }
    : EMPTY;
  return <ProjectForm id={id} initial={initial} />;
}

function ProjectForm({ id, initial }: { id?: string; initial: ProjectInput }) {
  const router = useRouter();
  const toast = useToast();
  const save = useSaveProject();
  const [form, setForm] = useState<ProjectInput>(initial);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const outcome = await save.mutateAsync({ id, input: form });
      if (outcome.queued) {
        toast('Hors ligne : le projet sera publié au retour du réseau.', 'queued');
        router.push('/projects');
      } else {
        router.push(`/projects/${outcome.result.id}`);
      }
    } catch {
      // erreur affichée sous le formulaire
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<FolderGit2 aria-hidden />}
        eyebrow={
          <Link href="/projects" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> Projets
          </Link>
        }
        title={id ? 'Modifier le projet' : 'Proposer un projet open source'}
        description="Les good first issues de votre dépôt GitHub sont importées automatiquement."
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <FormCard>
          <FormSection title="Le projet">
            <Field label="Nom du projet" required htmlFor="project-name" counter={`${form.name.length} / 100`}>
              <Input
                id="project-name"
                required
                maxLength={100}
                placeholder="Ex. pay-africa-sdk"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Dépôt GitHub" htmlFor="project-repo" hint="https://github.com/organisation/depot">
              <Input
                id="project-repo"
                type="url"
                inputMode="url"
                placeholder="https://github.com/…"
                value={form.repo_url}
                onChange={(event) => setForm({ ...form, repo_url: event.target.value })}
              />
            </Field>
            <Field label="Description" htmlFor="project-description" counter={`${form.description.length} / 3000`}>
              <Textarea
                id="project-description"
                maxLength={3000}
                placeholder="Le problème résolu, pour qui, et où vous en êtes."
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
          </FormSection>

          <FormSection title="Contributeurs" description="Aidez les bons développeurs à trouver votre projet.">
            <Field label="Technologies" htmlFor="project-tags" hint="Utilisées pour recommander le projet (jusqu'à 12).">
              <TagInput
                id="project-tags"
                max={12}
                value={form.tags}
                onChange={(tags) => setForm({ ...form, tags })}
                suggestions={['python', 'django', 'react', 'flutter', 'go']}
              />
            </Field>
            <ToggleRow
              icon={<UsersRound aria-hidden />}
              title="Je cherche des contributeurs"
              description="Le projet apparaît dans les recommandations des développeurs qui ont cette stack."
              checked={form.is_recruiting}
              onChange={(is_recruiting) => setForm({ ...form, is_recruiting })}
            />
            {save.isError ? <FormError>{errorMessage(save.error)}</FormError> : null}
          </FormSection>

          <FormFooter>
            <Button variant="ghost" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending}>
              <Save className="size-4" aria-hidden /> {id ? 'Enregistrer' : 'Publier le projet'}
            </Button>
          </FormFooter>
        </FormCard>

        <aside className="space-y-4">
          <TipCard tone="primary" icon={<Sparkles aria-hidden />} title="Un projet qui attire">
            <p>Une description qui dit quel problème vous résolvez, et pour qui.</p>
            <p>Des issues étiquetées « good first issue » sur GitHub : elles sont importées et mises en avant.</p>
          </TipCard>
          <TipCard icon={<BookOpen aria-hidden />} title="Guide de démarrage IA">
            <p>Depuis la page du projet, l&apos;IA rédige à la demande un guide de prise en main du dépôt pour les nouveaux contributeurs.</p>
          </TipCard>
        </aside>
      </form>
    </PageContainer>
  );
}
