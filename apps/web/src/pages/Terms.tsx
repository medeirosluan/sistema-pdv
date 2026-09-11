import { LegalLayout, LegalSection } from '../components/LegalLayout';

export function Terms() {
  return (
    <LegalLayout title="Termos de Uso" updatedAt="11/09/2026">
      <p>
        Estes Termos de Uso regulam a utilização do Sistema PDV (o “Sistema”).
        Ao criar uma conta ou utilizar o Sistema, você concorda com as condições
        abaixo.
      </p>

      <LegalSection title="1. Descrição do serviço">
        <p>
          O Sistema é uma plataforma de ponto de venda (PDV) oferecida no modelo
          SaaS (software como serviço), com recursos de vendas, caixa, estoque,
          clientes e relatórios.
        </p>
      </LegalSection>

      <LegalSection title="2. Cadastro e responsabilidade">
        <p>
          Você é responsável pela veracidade das informações cadastradas e pela
          guarda das credenciais de acesso dos usuários da sua loja. Todas as
          ações realizadas com as suas credenciais são de sua responsabilidade.
        </p>
      </LegalSection>

      <LegalSection title="3. Planos e pagamentos">
        <p>
          O uso pode estar sujeito a planos gratuitos ou pagos. Os valores,
          limites e formas de pagamento são informados na página de planos. O
          não pagamento pode levar à suspensão do acesso.
        </p>
      </LegalSection>

      <LegalSection title="4. Uso adequado">
        <p>
          É proibido utilizar o Sistema para atividades ilícitas, tentar
          acessar dados de outras lojas, ou realizar engenharia reversa não
          autorizada.
        </p>
      </LegalSection>

      <LegalSection title="5. Disponibilidade">
        <p>
          Buscamos a maior disponibilidade possível, mas o serviço pode passar
          por manutenções. Recursos offline minimizam interrupções nas vendas.
        </p>
      </LegalSection>

      <LegalSection title="6. Cancelamento">
        <p>
          Você pode cancelar a assinatura quando quiser. Após o cancelamento, o
          acesso aos recursos pagos é encerrado ao fim do período vigente.
        </p>
      </LegalSection>

      <LegalSection title="7. Contato">
        <p>Dúvidas sobre estes termos: suporte@sistemapdv.com.</p>
      </LegalSection>
    </LegalLayout>
  );
}
