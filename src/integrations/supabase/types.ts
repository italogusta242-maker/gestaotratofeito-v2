export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      cartoes: {
        Row: {
          bandeira: string | null
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          id: string
          limite: number | null
          nome: string
        }
        Insert: {
          bandeira?: string | null
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite?: number | null
          nome: string
        }
        Update: {
          bandeira?: string | null
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite?: number | null
          nome?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cpf_cnpj: string
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          nacionalidade: string | null
          nome: string
          rg: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf_cnpj: string
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          nacionalidade?: string | null
          nome: string
          rg?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          nacionalidade?: string | null
          nome?: string
          rg?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contas_bancarias: {
        Row: {
          created_at: string
          id: string
          nome: string
          saldo_inicial: number
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          saldo_inicial?: number
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: string
        }
        Relationships: []
      }
      contas_fixas: {
        Row: {
          ativo: boolean
          categoria: string | null
          centro_custo_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          descricao: string
          dia_vencimento: number
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          descricao: string
          dia_vencimento?: number
          id?: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          descricao?: string
          dia_vencimento?: number
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_fixas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_fixas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamentos: {
        Row: {
          centro_custo_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_inicio: string
          descricao: string
          id: string
          status: string
          taxa_juros: number | null
          total_parcelas: number
          updated_at: string
          valor_parcela: number
          valor_total: number
          veiculo_id: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_inicio?: string
          descricao: string
          id?: string
          status?: string
          taxa_juros?: number | null
          total_parcelas: number
          updated_at?: string
          valor_parcela: number
          valor_total: number
          veiculo_id?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_inicio?: string
          descricao?: string
          id?: string
          status?: string
          taxa_juros?: number | null
          total_parcelas?: number
          updated_at?: string
          valor_parcela?: number
          valor_total?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financiamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financiamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financiamentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_cache_respostas: {
        Row: {
          created_at: string
          id: string
          query_usuario: string
          resposta_ia: string
          tipo_intencao: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_usuario: string
          resposta_ia: string
          tipo_intencao: string
        }
        Update: {
          created_at?: string
          id?: string
          query_usuario?: string
          resposta_ia?: string
          tipo_intencao?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      regras_categorizacao: {
        Row: {
          categoria_sugerida: string | null
          centro_custo_sugerido: string | null
          created_at: string
          id: string
          palavra_chave: string
        }
        Insert: {
          categoria_sugerida?: string | null
          centro_custo_sugerido?: string | null
          created_at?: string
          id?: string
          palavra_chave: string
        }
        Update: {
          categoria_sugerida?: string | null
          centro_custo_sugerido?: string | null
          created_at?: string
          id?: string
          palavra_chave?: string
        }
        Relationships: [
          {
            foreignKeyName: "regras_categorizacao_centro_custo_sugerido_fkey"
            columns: ["centro_custo_sugerido"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes: {
        Row: {
          cartao_id: string | null
          categoria: string | null
          centro_custo_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          favorecido_pagador: string | null
          financiamento_id: string | null
          forma_pagamento: string | null
          id: string
          parcela_atual: number | null
          status: string
          tipo: string
          total_parcelas: number | null
          user_id: string | null
          valor: number
          veiculo_id: string | null
        }
        Insert: {
          cartao_id?: string | null
          categoria?: string | null
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao: string
          favorecido_pagador?: string | null
          financiamento_id?: string | null
          forma_pagamento?: string | null
          id?: string
          parcela_atual?: number | null
          status?: string
          tipo: string
          total_parcelas?: number | null
          user_id?: string | null
          valor: number
          veiculo_id?: string | null
        }
        Update: {
          cartao_id?: string | null
          categoria?: string | null
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          favorecido_pagador?: string | null
          financiamento_id?: string | null
          forma_pagamento?: string | null
          id?: string
          parcela_atual?: number | null
          status?: string
          tipo?: string
          total_parcelas?: number | null
          user_id?: string | null
          valor?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financiamento_id_fkey"
            columns: ["financiamento_id"]
            isOneToOne: false
            referencedRelation: "financiamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          ano: string
          ano_modelo: string | null
          centro_custo_id: string | null
          chassi: string | null
          cliente_compra_id: string | null
          cliente_venda_id: string | null
          combustivel: string | null
          cor: string | null
          created_at: string
          data_entrada_patio: string | null
          desconto: number
          forma_pagamento: string | null
          id: string
          ipva: number
          is_consignment: boolean
          licenciamento: number
          localizacao: string
          marca_modelo: string
          multas: number
          placa: string
          renavam: string | null
          status: string
          updated_at: string
          valor_aquisicao: number
          valor_venda: number | null
        }
        Insert: {
          ano: string
          ano_modelo?: string | null
          centro_custo_id?: string | null
          chassi?: string | null
          cliente_compra_id?: string | null
          cliente_venda_id?: string | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          data_entrada_patio?: string | null
          desconto?: number
          forma_pagamento?: string | null
          id?: string
          ipva?: number
          is_consignment?: boolean
          licenciamento?: number
          localizacao?: string
          marca_modelo: string
          multas?: number
          placa: string
          renavam?: string | null
          status?: string
          updated_at?: string
          valor_aquisicao?: number
          valor_venda?: number | null
        }
        Update: {
          ano?: string
          ano_modelo?: string | null
          centro_custo_id?: string | null
          chassi?: string | null
          cliente_compra_id?: string | null
          cliente_venda_id?: string | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          data_entrada_patio?: string | null
          desconto?: number
          forma_pagamento?: string | null
          id?: string
          ipva?: number
          is_consignment?: boolean
          licenciamento?: number
          localizacao?: string
          marca_modelo?: string
          multas?: number
          placa?: string
          renavam?: string | null
          status?: string
          updated_at?: string
          valor_aquisicao?: number
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_cliente_compra_id_fkey"
            columns: ["cliente_compra_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_cliente_venda_id_fkey"
            columns: ["cliente_venda_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_casa_socios_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "auxiliar_operacional" | "auxiliar_emissao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "auxiliar_operacional", "auxiliar_emissao"],
    },
  },
} as const
