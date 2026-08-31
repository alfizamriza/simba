// Script buat bikin akun guru (termasuk admin) tanpa perlu klik UI Supabase.
// Pakai Admin API resmi, jadi aman -- password di-hash otomatis oleh Supabase.
//
// CARA PAKAI:
//   node scripts/create-guru.mjs <nip> <nama> <password> <role>
//
// CONTOH:
//   node scripts/create-guru.mjs admin "Alfi Zamriza" "PasswordKuat123!" admin
//   node scripts/create-guru.mjs 198501012010011001 "Budi Santoso" "Rahasia456!" wali_kelas
//
// Butuh SUPABASE_SERVICE_ROLE_KEY dan NEXT_PUBLIC_SUPABASE_URL di .env.local

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const DOMAIN_INTERNAL = 'simba.internal'

const [nip, nama, password, role] = process.argv.slice(2)

if (!nip || !nama || !password || !role) {
  console.error('Pemakaian: node scripts/create-guru.mjs <nip> <nama> <password> <role>')
  console.error('Role yang valid: admin, wali_kelas, guru_mapel, kepala_sekolah')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const email = `${nip}@${DOMAIN_INTERNAL}`
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) throw new Error(`Gagal mencari user auth: ${usersError.message}`)

  let user = usersData.users.find((item) => item.email === email)
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true })
    if (error) throw new Error(`Gagal memperbarui user auth: ${error.message}`)
    user = data.user
    console.log('User auth sudah ada, password diperbarui. UID:', user.id)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`Gagal buat user auth: ${error.message}`)
    user = data.user
    console.log('User auth berhasil dibuat, UID:', user.id)
  }

  let { data: guruData, error: guruError } = await supabase.from('guru').select('id').eq('user_id', user.id).maybeSingle()
  if (guruError) throw new Error(`Gagal mencari profil guru: ${guruError.message}`)

  if (!guruData) {
    const result = await supabase.from('guru').insert({ user_id: user.id, nama, nip }).select('id').single()
    guruData = result.data
    guruError = result.error
    if (guruError) throw new Error(`Gagal insert ke tabel guru: ${guruError.message}`)
  }

  const { data: existingRole, error: roleLookupError } = await supabase
    .from('guru_roles')
    .select('id')
    .eq('guru_id', guruData.id)
    .eq('role', role)
    .maybeSingle()
  if (roleLookupError) throw new Error(`Gagal mencari role: ${roleLookupError.message}`)

  if (!existingRole) {
    const { error: roleError } = await supabase.from('guru_roles').insert({ guru_id: guruData.id, role })
    if (roleError) throw new Error(`Gagal insert role: ${roleError.message}`)
  }

  console.log(`Berhasil! Guru "${nama}" (NIP: ${nip}) dibuat dengan role "${role}".`)
  console.log(`Login pakai NIP: ${nip}`)
}

main()
