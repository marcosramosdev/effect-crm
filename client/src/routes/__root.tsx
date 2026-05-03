import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-mesh bg-grain p-6">
      <div className="text-center max-w-md anim-fade-up">
        <p className="chip chip-primary mx-auto w-fit mb-5">Erro 404</p>
        <h1 className="font-display text-6xl font-bold tracking-tight mb-3 text-balance">
          Página não encontrada
        </h1>
        <p className="text-base-content/65 mb-7 text-pretty">
          O link que você seguiu pode estar quebrado ou a página foi movida.
        </p>
        <a href="/" className="btn btn-neutral rounded-full px-5">
          Voltar ao início
        </a>
      </div>
    </div>
  ),
})
function RootComponent() {
  return (
    <>
      <Outlet />
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
