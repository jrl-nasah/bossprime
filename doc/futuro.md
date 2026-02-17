# Boss Prime — Trabalhos Futuros

Tarefas planejadas para implementar quando houver disponibilidade.

---

## 1. Sort por distância (Geolocalização)

**Prioridade**: Média  
**Pré-requisito**: Campos `latitude` e `longitude` nos itens do HubSpot

### O que é

Ordenar os imóveis do mais próximo ao mais longe do visitante, usando a localização do navegador (Geolocation API).

### Por que não está implementado ainda

- **Não temos lat/lng nos dados** — o mapa atual usa endereço textual (`rua, número, bairro, cidade, CEP`) via Google Maps embed
- Geocodificar endereço → coordenadas no client exigiria Google Geocoding API (pago e lento)
- Sem coordenadas, não tem como calcular distância

### Como implementar (quando tiver lat/lng)

1. **HubSpot**: Adicionar campos `latitude` (Number) e `longitude` (Number) em cada item do grupo `items`
2. **Preencher**: Inserir manualmente ou via script as coordenadas de cada imóvel
3. **HTML**: Emitir `data-lat="{{ it.latitude }}"` e `data-lng="{{ it.longitude }}"` no `<article data-prop-card>`
4. **JS**:
   - Adicionar opção `<option value="distance">Mais próximo</option>` no `<select data-sort>`
   - Quando selecionado, pedir `navigator.geolocation.getCurrentPosition()`
   - Calcular distância Haversine entre visitante e cada imóvel
   - Ordenar por distância ascendente
5. **Fallback**: Se o usuário negar localização, mostrar aviso e manter sort padrão

### Fórmula Haversine (referência)

```javascript
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

### Compatibilidade

- Geolocation API: suportada em todos os navegadores modernos
- Requer HTTPS (HubSpot já serve em HTTPS)
- Padrão de mercado: Zap, VivaReal, Zillow usam

---

## 2. (espaço para futuras tarefas)

_Adicionar aqui conforme surgirem novas ideias._
