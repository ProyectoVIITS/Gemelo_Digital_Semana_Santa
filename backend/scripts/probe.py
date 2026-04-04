import pandas as pd
df = pd.read_excel('../../data/incidentes_ditra.xlsx', nrows=5)
print("Columnas:", df.columns.tolist())
for c in df.columns:
    if 'FECH' in str(c).upper() or 'HORA' in str(c).upper():
        print(f"[{c}] -> Valores: {df[c].tolist()}")
