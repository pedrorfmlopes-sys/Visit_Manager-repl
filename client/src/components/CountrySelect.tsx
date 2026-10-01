import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { ISO_COUNTRY_CODES, getCountryName } from "@shared/countries";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const countryOptions = ISO_COUNTRY_CODES.map((code) => ({
  code,
  name: getCountryName(code),
})).sort((first, second) => first.name.localeCompare(second.name, "pt"));

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}

export function CountrySelect({
  value,
  onChange,
  disabled = false,
  testId = "select-country",
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const selected = countryOptions.find((option) => option.code === value) ??
    countryOptions.find((option) => option.code === "PT");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-12 w-full justify-between font-normal"
          data-testid={testId}
        >
          <span className="truncate">
            {selected ? `${selected.name} (${selected.code})` : "Selecionar país"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar país..." data-testid={`${testId}-search`} />
          <CommandList>
            <CommandEmpty>País não encontrado.</CommandEmpty>
            <CommandGroup>
              {countryOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.name} ${option.code}`}
                  onSelect={() => {
                    onChange(option.code);
                    setOpen(false);
                  }}
                  data-testid={`${testId}-option-${option.code}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1">{option.name}</span>
                  <span className="text-xs text-muted-foreground">{option.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

