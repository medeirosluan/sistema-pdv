import { LegalLayout, LegalSection } from '../components/LegalLayout';

export function Privacy() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="11/09/2026">
      <p>
        Esta Política descreve como o Sistema PDV trata os dados pessoais, em
        conformidade com a Lei Geral de Proteção de Dados (LGPD).
      </p>

      <LegalSection title="1. Dados que tratamos">
        <p>
          Dados da loja (nome, documento, contato), dados dos usuários (nome,
          e-mail) e dados de clientes cadastrados pela loja (nome, documento,
          telefone, e-mail). Também registramos informações de uso e segurança
          (como logs de acesso e auditoria).
        </p>
      </LegalSection>

      <LegalSection title="2. Finalidade">
        <p>
          Utilizamos os dados para operar o Sistema, emitir vendas, gerar
          relatórios, garantir a segurança e cumprir obrigações legais.
        </p>
      </LegalSection>

      <LegalSection title="3. Isolamento e segurança">
        <p>
          Cada loja tem seus dados isolados. Aplicamos controles como
          criptografia de senhas, verificação em duas etapas, permissões por
          usuário, auditoria e isolamento no banco de dados (Row Level
          Security).
        </p>
      </LegalSection>

      <LegalSection title="4. Compartilhamento">
        <p>
          Não vendemos seus dados. Podemos compartilhar com prestadores
          necessários à operação (por exemplo, gateway de pagamento) e quando
          exigido por lei.
        </p>
      </LegalSection>

      <LegalSection title="5. Direitos do titular">
        <p>
          O titular pode solicitar acesso, correção ou exclusão de seus dados.
          A loja é a controladora dos dados de seus clientes; o Sistema atua
          como operador.
        </p>
      </LegalSection>

      <LegalSection title="6. Retenção e exclusão">
        <p>
          Mantemos os dados enquanto a conta estiver ativa e pelo prazo
          necessário ao cumprimento de obrigações legais.
        </p>
      </LegalSection>

      <LegalSection title="7. Contato">
        <p>Para exercer seus direitos: privacidade@sistemapdv.com.</p>
      </LegalSection>
    </LegalLayout>
  );
}
