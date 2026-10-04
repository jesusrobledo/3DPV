from math import exp
from scipy import constants
from scipy.optimize import fsolve
from pvlib.pvsystem import calcparams_pvsyst
import os
import numpy as np
import zipfile

current_path = os.path.dirname(__file__)

def _V(V, n, IL0, I0, Rs, Rp, alpha, Vbr, G, T, m, I):
    # Single diode simple example
    return -I + G/1000.0*IL0 - I0*(exp(constants.elementary_charge*(V+I*Rs)/(n*constants.Boltzmann*(T+273.15)))-1) - (V+I*Rs)/Rp*(1+alpha/((1.0-(V+I*Rs)/Vbr)**m))

class Cell ():
    def __init__(self):
        self.area = 150             # cm2
        self.alpha = 0.35           # Fraction of ohmic current in avalanche breakdown
        self.Vbr = -15              # Reverse current breakdown (V)
        self.m = 3.8                # Avalanche breakdown exponent
        self.temp = 25              # Temperature (ºC)
        self.G = 1000               # Irradiance (W/m2)
        self.gamma = 1              # Diode ideality factor
        self.mu_gamma = 0.4         # Gamma temperature coefficient (%/C??)
        self.r_s = 0.1              # Series resistance (Ohms)
        self.r_sh = 500             # Shunt resistance at STC (Ohms)
        self.r_0 = 4000             # Shunt resistance at zero irradiance (Ohms)
        self.r_sh_exp = 3.5         # Shunt resistance irradiance exponent
        self.v = 0                  # Cell voltage (V)
        self.i = 0                  # Cell current (A)
        self.htc = 25               # Heat transfer coefficient (W/m2·K) - Key contributor for the balanced temperature
        self.absortion = 0.75        # Fraction of irradiance energy converted into heat
    def get_data_from_PAN_file(self,file):
        # Read the information at module level
        with open(file, "r") as f:
            data = f.readlines()
        for line in data:
            parameter = (line.split("="))[0]
            if "CellArea" in parameter:
                self.area = float((line.split("="))[1])
            if "NCelS" in parameter:
                n_s = float((line.split("="))[1])
            if ("Gamma" in parameter) and not ("muGamma" in parameter):
                self.gamma = float((line.split("="))[1])
            if "muGamma" in parameter:
                self.mu_gamma = float((line.split("="))[1])
            if "muISC" in parameter:
                self.mu_isc = float((line.split("="))[1])
            if "RSerie" in parameter:
                r_s = float((line.split("="))[1])
            if "RShunt" in parameter:
                r_sh = float((line.split("="))[1])
            if "Rp_0" in parameter:
                r_sh_0 = float((line.split("="))[1])
            if "Rp_Exp" in parameter:
                self.r_sh_exp = float((line.split("="))[1])
            if ("Voc" in parameter) and not ("muVocSpec" in parameter):
                v_oc = float((line.split("="))[1])
            if ("Isc" in parameter) and not ("muIsc" in parameter):
                i_sc = float((line.split("="))[1])

        # STC irradiance parameters for the 5 parameters model
        v_t = constants.Boltzmann*self.gamma*298/constants.elementary_charge
        self.i_0 = -(v_oc / r_sh - i_sc * (1 + r_s / r_sh)) / (exp(v_oc / (n_s * v_t)) - exp(i_sc * r_s / (n_s * v_t)))
        self.i_ph = v_oc / r_sh + self.i_0 * (exp(v_oc / (n_s * v_t)) - 1)

        # Convert the module parameters to cell parameters
        self.r_s = r_s/n_s
        self.r_sh = r_sh / n_s
        self.r_sh_0 = r_sh_0/n_s
        self.mass = self.area*0.017*2.33*1E-3
    def V(self,G,T,I):
        # Method to get the voltage from a certain combination of current, irradiance and temperature
        # conditions on the cell

        # Get the five parameters used in the single diode method
        self.irr = G
        self.i = I
        self.temp = T
        params = calcparams_pvsyst(effective_irradiance=G,
                                   temp_cell=T,
                                   alpha_sc=self.mu_isc/100,
                                   #alpha_sc=0,
                                   gamma_ref=self.gamma,
                                   mu_gamma=self.mu_gamma,
                                   #mu_gamma=0,
                                   I_L_ref=self.i_ph,
                                   I_o_ref=self.i_0,
                                   R_sh_ref=self.r_sh,
                                   R_sh_0=self.r_sh_0,
                                   R_s=self.r_s,
                                   cells_in_series=1,
                                   R_sh_exp=self.r_sh_exp,
                                   EgRef=1.121,                 # Currently only Si cells
                                   irrad_ref=1000,
                                   temp_ref=25)
        i_ph = params[0]
        i_0 = params[1]
        r_s = params[2]
        r_sh = params[3]

        self.v = (fsolve(_V, 0.7, args=(self.gamma, i_ph, i_0, r_s, r_sh, self.alpha, self.Vbr, self.irr, self.temp, self.m, self.i)))[0]
        return

# Create and instance of a cell for this PAN file
cell = Cell()
cell.get_data_from_PAN_file(os.path.join(current_path, 'static', 'ET_M772BH550GL.PAN'))

Tmin = -10
Tmax = 80
nT = 32
Gmin = 0
Gmax = 1200
nG = 64
nI = 2048
T = np.linspace(float(Tmin), float(Tmax), int(nT))
G = np.linspace(float(Gmin), float(Gmax), int(nG))
I = np.linspace(0, 1.10 * cell.i_ph, int(nI))

data_3d = np.zeros((nI, nG, nT), dtype=np.float32)
V = []
for i3 in range(len(I)):
    print(i3)
    for i2 in range(len(G)):
        for i1 in range(len(T)):
            cell.V(G=G[i2], I=I[i3], T=T[i1])
            data_3d[i3, i2, i1] = cell.v

data_bytes = data_3d.tobytes()
with zipfile.ZipFile("Test.zip", 'w', compression=zipfile.ZIP_DEFLATED) as zip_file:
    zip_file.writestr('lut_data.bin', data_bytes)