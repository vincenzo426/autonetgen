
output "original_to_gcp_mapping" {
  value = {
    "185.175.0.6" = "${google_compute_instance.host_185_175_0_6.network_interface[0].network_ip}"
    "185.175.0.3" = "${google_compute_instance.host_185_175_0_3.network_interface[0].network_ip}"
    "224.0.0.251" = "${google_compute_instance.host_224_0_0_251.network_interface[0].network_ip}"
    "185.175.0.5" = "${google_compute_instance.host_185_175_0_5.network_interface[0].network_ip}"
    "185.175.0.1" = "${google_compute_instance.host_185_175_0_1.network_interface[0].network_ip}"
    "185.175.0.8" = "${google_compute_instance.host_185_175_0_8.network_interface[0].network_ip}"
    "185.175.0.4" = "${google_compute_instance.host_185_175_0_4.network_interface[0].network_ip}"

  }
  description = "Mappatura degli indirizzi IP originali agli indirizzi IP GCP"
}
