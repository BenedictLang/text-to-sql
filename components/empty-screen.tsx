import { UseChatHelpers } from 'ai/react'

import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/external-link'
import { IconArrowRight } from '@/components/ui/icons'

export function EmptyScreen() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
        <h1 className="text-lg font-semibold">
          Welcome to your triage assistent!
        </h1>
        <p className="leading-normal text-muted-foreground">
          Connect a database and ask me questions about it.
        </p>
        <p className="mt-4 italic leading-normal text-muted-foreground">
          This chatbot is part of a text-to-SQL transformation test focused on
          log analysis under the topic 'Leveraging Large Language Models
          for Modern Security Incident Management,' intended for scientific purposes
          and not for production.
        </p>
        <p className="leading-normal text-muted-foreground">
          You can find the projects sourcecode on
          {' '}<ExternalLink href="https://github.com/BenedictLang/text-to-sql">GitHub</ExternalLink>{' '}.
        </p>
      </div>
    </div>
  )
}
