import { useState } from "react";
import axios from "axios";

export default function SubmitApplication() {

  const [form, setForm] = useState({
    type: "First Registration",
    name: "",
    national_id: "",
    phone: "",
    parcel_number: "",
    block: "",
    basin: "",
    zone: "",
    latitude: "",
    longitude: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = () => {

    // 🧠 VALIDATION (important for doctor)
    if (!form.name || !form.national_id || !form.parcel_number) {
      alert("Please fill required fields");
      return;
    }

    const payload = {
      type: form.type,

      applicant: {
        name: form.name,
        national_id: form.national_id,
        phone: form.phone
      },

      parcel: {
        parcel_number: form.parcel_number,
        block: form.block,
        basin: form.basin,
        zone: form.zone
      },

      location: {
        lat: parseFloat(form.latitude),
        lng: parseFloat(form.longitude)
      }
    };

    axios.post("http://127.0.0.1:8000/applications", payload)
      .then(res => {
        alert("Application Created: " + res.data.application_id);

        // 🧹 reset form
        setForm({
          type: "First Registration",
          name: "",
          national_id: "",
          phone: "",
          parcel_number: "",
          block: "",
          basin: "",
          zone: "",
          latitude: "",
          longitude: ""
        });

      })
      .catch(err => {
        console.log(err);
        alert("Error creating application");
      });
  };

  return (
    <div className="container">

      <h2 className="page-title">Submit Application</h2>

      <select name="type" value={form.type} onChange={handleChange}>
        <option>First Registration</option>
        <option>Ownership Transfer</option>
        <option>Parcel Subdivision</option>
        <option>Parcel Merge</option>
      </select>

      <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} />
      <input name="national_id" placeholder="National ID" value={form.national_id} onChange={handleChange} />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />

      <input name="parcel_number" placeholder="Parcel Number" value={form.parcel_number} onChange={handleChange} />
      <input name="block" placeholder="Block" value={form.block} onChange={handleChange} />
      <input name="basin" placeholder="Basin" value={form.basin} onChange={handleChange} />
      <input name="zone" placeholder="Zone" value={form.zone} onChange={handleChange} />

      <input name="latitude" placeholder="Latitude" value={form.latitude} onChange={handleChange} />
      <input name="longitude" placeholder="Longitude" value={form.longitude} onChange={handleChange} />

      <button onClick={submit}>
        Submit Application
      </button>

    </div>
  );
}