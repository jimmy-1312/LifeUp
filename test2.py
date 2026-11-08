# 1. 基礎參數與折現因子（與前述一致）
r_3m, r_9m, r_15m = 0.034, 0.036, 0.038
t_3m, t_9m, t_15m = 3/12, 9/12, 15/12

D_3m = (1 + r_3m / 2) ** (-2 * t_3m)
D_9m = (1 + r_9m / 2) ** (-2 * t_9m)
D_15m = (1 + r_15m / 2) ** (-2 * t_15m)

old_fixed_pmt = 0.036 / 2
old_float_pmt_1 = 0.037 / 2

# 2. 計算當前市場公允的「新互換利率」 (New Swap Rate)
# 注意：新互換只覆蓋未來待定部分，其公允費率由對應的折現因子決定
new_fixed_pmt = (D_3m - D_15m) / (D_3m + D_9m + D_15m)
s_new = new_fixed_pmt * 2

# 3. 計算第一期已知利差的現值
pv_part1 = (old_float_pmt_1 - old_fixed_pmt) * D_3m

# 4. 計算後續期數（期2、期3）固定利差的現值
# 舊合約是支付舊固定(old_fixed_pmt)，對沖後相當於收取新固定(new_fixed_pmt)
pv_part2 = (new_fixed_pmt - old_fixed_pmt) * (D_9m + D_15m)

# 5. 加總得到互換價值
swap_value_receive_float = pv_part1 + pv_part2
swap_value_receive_fixed = -swap_value_receive_float

print(f"新公允互換利率 (S_new): {s_new:.6f} (每期固定支付: {new_fixed_pmt:.6f})")
print(f"第一期利差現值: {pv_part1:.6f}")
print(f"後續期數利差現值: {pv_part2:.6f}")
print(f"互換價值 (收取浮動、支付固定): {swap_value_receive_float:.6f}")
print(f"互換價值 (收取固定、支付浮動): {swap_value_receive_fixed:.6f}")
