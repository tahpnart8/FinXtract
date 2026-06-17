import pandas as pd
import numpy as np
import re

def clean_value(v):
    if pd.isna(v) or v is None:
        return 0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(',', '').replace(' ', '').replace('.', '').strip()
    if s == '' or s == '-':
        return 0
    try:
        return float(s)
    except:
        return 0

def normalize_text(text):
    if pd.isna(text): return ""
    # lower case, remove spaces, non-alphanumeric
    return re.sub(r'[^a-z0-9]', '', str(text).lower())

def extract_year(text):
    m = re.search(r'20\d\d', str(text))
    return m.group(0) if m else None

def compare_files():
    llama_file = r"c:\Users\User\Documents\PERSONAL PROJECT\BCTC-CRAWLING PROJECT\LLAMA4SOUT_ HPG_BCTC_2022_2025.xlsx"
    gemini_file = r"c:\Users\User\Documents\PERSONAL PROJECT\BCTC-CRAWLING PROJECT\GEMINI-HPG_BCTC_2022_2025.xlsx"
    truth_file = r"c:\Users\User\Documents\PERSONAL PROJECT\BCTC-CRAWLING PROJECT\HPG_2022_2025_GỐC.xlsx"

    with open('scratch_report.txt', 'w', encoding='utf-8') as f:
        try:
            df_truth = pd.read_excel(truth_file)
            df_llama = pd.read_excel(llama_file)
            df_gemini = pd.read_excel(gemini_file)
            
            # Use the first column as the index names
            truth_idx = df_truth.iloc[:, 0]
            llama_idx = df_llama.iloc[:, 0]
            gemini_idx = df_gemini.iloc[:, 0]
            
            # Map columns to year
            truth_cols = {extract_year(c): c for c in df_truth.columns if extract_year(c)}
            llama_cols = {extract_year(c): c for c in df_llama.columns if extract_year(c)}
            gemini_cols = {extract_year(c): c for c in df_gemini.columns if extract_year(c)}
            
            common_years = list(set(truth_cols.keys()) & set(llama_cols.keys()) & set(gemini_cols.keys()))
            common_years.sort()
            f.write(f"Common years: {common_years}\n\n")
            
            # Precompute normalized indexes
            norm_truth_idx = {normalize_text(v): i for i, v in enumerate(truth_idx)}
            
            total_cells = 0
            llama_correct = 0
            gemini_correct = 0
            llama_errors = []
            
            # We iterate over the generated file rows
            for i, row_name in enumerate(llama_idx):
                norm_row = normalize_text(row_name)
                # Find matching row in truth
                if norm_row not in norm_truth_idx:
                    continue
                truth_i = norm_truth_idx[norm_row]
                
                # Check Gemini (assume Gemini has the same rows as Llama since they use same code)
                gemini_row_idx = None
                for gi, g_name in enumerate(gemini_idx):
                    if normalize_text(g_name) == norm_row:
                        gemini_row_idx = gi
                        break
                        
                for y in common_years:
                    tc = truth_cols[y]
                    lc = llama_cols[y]
                    gc = gemini_cols[y]
                    
                    val_t = clean_value(df_truth.loc[truth_i, tc])
                    val_l = clean_value(df_llama.loc[i, lc])
                    val_g = clean_value(df_gemini.loc[gemini_row_idx, gc]) if gemini_row_idx is not None else 0
                    
                    if val_t == 0 and val_l == 0 and val_g == 0:
                        continue
                        
                    total_cells += 1
                    
                    if np.isclose(val_t, val_g, rtol=0.01, atol=1000000):
                        gemini_correct += 1
                        
                    if np.isclose(val_t, val_l, rtol=0.01, atol=1000000):
                        llama_correct += 1
                    else:
                        diff = val_l - val_t
                        llama_errors.append({
                            "row": str(row_name),
                            "year": y,
                            "truth": val_t,
                            "llama": val_l,
                            "diff": diff
                        })

            f.write(f"--- BÁO CÁO ACCURACY ---\n")
            f.write(f"Tổng số ô dữ liệu so sánh (khác 0): {total_cells}\n")
            if total_cells > 0:
                f.write(f"Gemini Accuracy: {gemini_correct}/{total_cells} ({(gemini_correct/total_cells)*100:.2f}%)\n")
                f.write(f"Llama Accuracy:  {llama_correct}/{total_cells} ({(llama_correct/total_cells)*100:.2f}%)\n")
            
            f.write("\n--- TOP 30 LỖI SAI CỦA LLAMA (Theo chênh lệch lớn nhất) ---\n")
            llama_errors.sort(key=lambda x: abs(x['diff']), reverse=True)
            for e in llama_errors[:30]:
                f.write(f"Row: {e['row'][:50]:<50} | Year: {e['year']}\n")
                f.write(f"  -> Truth: {e['truth']:,.0f}\n")
                f.write(f"  -> Llama: {e['llama']:,.0f} (Diff: {e['diff']:,.0f})\n")

        except Exception as e:
            f.write(f"Error reading files: {e}\n")

if __name__ == "__main__":
    compare_files()
